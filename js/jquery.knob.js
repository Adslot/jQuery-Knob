/*!jQuery Knob*/
/**
 * Downward compatible, touchable dial
 *
 * Version: 1.2.0 (15/07/2012)
 * Requires: jQuery v1.7+
 *
 * Copyright (c) 2012 Anthony Terrien
 * Under MIT and GPL licenses:
 *  http://www.opensource.org/licenses/mit-license.php
 *  http://www.gnu.org/licenses/gpl.html
 *
 * Thanks to vor, eskimoblood, spiffistan, FabrizioC
 */
(function($) {

    /**
     * Kontrol library
     */
    "use strict";

    /**
     * Definition of globals and core
     */
    var k = {}, // kontrol
        max = Math.max,
        min = Math.min;

    k.c = {};
    k.c.d = $(document);
    k.c.t = function (e) {
        return e.originalEvent.touches.length - 1;
    };
    
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      this.beginPath();
      this.moveTo(x+r, y);
      this.arcTo(x+w, y,   x+w, y+h, r);
      this.arcTo(x+w, y+h, x,   y+h, r);
      this.arcTo(x,   y+h, x,   y,   r);
      this.arcTo(x,   y,   x+w, y,   r);
      this.closePath();
      return this;
    }

    /**
     * Kontrol Object
     *
     * Definition of an abstract UI control
     *
     * Each concrete component must call this one.
     * <code>
     * k.o.call(this);
     * </code>
     */
    k.o = function () {
        var s = this;

        this.o = null; // array of options
        this.$ = null; // jQuery wrapped element
        this.i = null; // mixed HTMLInputElement or array of HTMLInputElement
        this.g = null; // 2D graphics context for 'pre-rendering'
        this.v = null; // value ; mixed array or integer
        this.cv = null; // change value ; not commited value
        this.x = 0; // canvas x position
        this.y = 0; // canvas y position
        this.$c = null; // jQuery canvas element
        this.c = null; // rendered canvas context
        this.t = 0; // touches index
        this.isInit = false;
        this.fgColor = null; // main color
        this.pColor = null; // previous color
        this.dH = null; // draw hook
        this.cH = null; // change hook
        this.eH = null; // cancel hook
        this.rH = null; // release hook

        this.run = function () {
            var cf = function (e, conf) {
                var k;
                for (k in conf) {
                    s.o[k] = conf[k];
                }
                s.init();
                s._configure()
                 ._draw();
            };

            if(this.$.data('kontroled')) return;
            this.$.data('kontroled', true);

            this.extend();
            this.o = $.extend(
                {
                    // Config
                    min : this.$.data('min') || 0,
                    max : this.$.data('max') || 100,
                    selectableSet : this.$.data('selectableSet'),
                    selectableMin : (typeof this.$.data('selectableSet') !== 'undefined' ) ?
                        this.$.data('selectableSet')[0] :
                        (this.$.data('selectableMin') || (this.$.data('min') || 0)),
                    selectableMax : (typeof this.$.data('selectableSet') !== 'undefined' ) ?
                        this.$.data('selectableSet')[this.$.data('selectableSet').length - 1] :
                        (this.$.data('selectableMax') || (this.$.data('max') || 100)),
                    stopper : true,
                    readOnly : this.$.data('readonly'),

                    // UI
                    cursor : (this.$.data('cursor') === true && 30)
                                || this.$.data('cursor')
                                || 0,
                    thickness : this.$.data('thickness') || 0.35,
                    width : this.$.data('width') || 200,
                    height : this.$.data('height') || 200,
                    displayInput : this.$.data('displayinput') == null || this.$.data('displayinput'),
                    displayPrevious : this.$.data('displayprevious'),
                    displayUnselectable : this.$.data('displayunselectable'),
                    displaySegmented : this.$.data('displaysegmented'),
                    segmentSkip : this.$.data('segmentskip') || null,
                    fgColor : this.$.data('fgcolor') || '#87CEEB',
                    mColor : this.$.data('mcolor') || '#FFFFFF',
                    hColor : this.$.data('hcolor'),
                    hbColor : this.$.data('hbcolor'),
                    hRadius : this.$.data('hradius') || 1.5,
                    bColor : this.$.data('bcolor'),
                    bRadius : this.$.data('bradius') || 0,
                    mTexture : document.getElementById(this.$.data('mtexture')),
                    bgTexture : document.getElementById(this.$.data('bgtexture')),
                    showHandle : this.$.data('showHandle'),
                    lockText: this.$.data('locktext'),
                    inline : false,

                    // Hooks
                    draw : null, // function () {}
                    change : null, // function (value) {}
                    cancel : null, // function () {}
                    release : null // function (value) {}
                }, this.o
            );

            // routing value
            if(this.$.is('fieldset')) {

                // fieldset = array of integer
                this.v = {};
                this.i = this.$.find('input')
                this.i.each(function(k) {
                    var $this = $(this);
                    s.i[k] = $this;
                    s.v[k] = $this.val();

                    $this.bind(
                        'change'
                        , function () {
                            var val = {};
                            val[k] = $this.val();
                            s.val(val);
                        }
                    );
                });
                this.$.find('legend').remove();

            } else {
                // input = integer
                this.i = this.$;
                this.v = this.$.val();
                (this.v == '') && (this.v = this.o.min);

                this.$.bind(
                    'change'
                    , function () {
                        s.val(s.$.val());
                    }
                );
            }

            (!this.o.displayInput) && this.$.hide();

            this.$c = $('<canvas width="' +
                            this.o.width + 'px" height="' +
                            this.o.height + 'px"></canvas>');
            this.c = this.$c[0].getContext("2d");

            this.$
                .wrap($('<div style="' + (this.o.inline ? 'display:inline;' : '') +
                        'width:' + this.o.width + 'px;height:' +
                        this.o.height + 'px;"></div>'))
                .before(this.$c);

            if (this.v instanceof Object) {
                this.cv = {};
                this.copy(this.v, this.cv);
            } else {
                this.cv = this.v;
            }

            this.$
                .bind("configure", cf)
                .parent()
                .bind("configure", cf);

            this._listen()
                ._configure()
                ._xy()
                .init();

            this.isInit = true;

            this._draw();

            return this;
        };

        this._draw = function () {

            // canvas pre-rendering
            var d = true,
                c = document.createElement('canvas');

            c.width = s.o.width;
            c.height = s.o.height;
            s.g = c.getContext('2d');

            s.clear();

            s.dH
            && (d = s.dH());

            (d !== false) && s.draw();

            s.c.drawImage(c, 0, 0);
            c = null;
        };

        this._touch = function (e) {

            var touchMove = function (e) {

                var v = s.xy2val(
                            e.originalEvent.touches[s.t].pageX,
                            e.originalEvent.touches[s.t].pageY
                            );

                if (v == s.cv) return;

                if (
                    s.cH
                    && (s.cH(v) === false)
                ) return;


                s.change(v);
                s._draw();
            };

            // get touches index
            this.t = k.c.t(e);

            // First touch
            touchMove(e);

            // Touch events listeners
            k.c.d
                .bind("touchmove.k", touchMove)
                .bind(
                    "touchend.k"
                    , function () {
                        k.c.d.unbind('touchmove.k touchend.k');

                        if (
                            s.rH
                            && (s.rH(s.cv) === false)
                        ) return;

                        s.val(s.cv);
                    }
                );

            return this;
        };

        this._mouse = function (e) {

            var mouseMove = function (e) {
                var v = s.xy2val(e.pageX, e.pageY);
                if (v == s.cv) return;

                if (
                    s.cH
                    && (s.cH(v) === false)
                ) return;

                s.change(v);
                s._draw();
            };

            // First click
            mouseMove(e);

            // Mouse events listeners
            k.c.d
                .bind("mousemove.k", mouseMove)
                .bind(
                    // Escape key cancel current change
                    "keyup.k"
                    , function (e) {
                        if (e.keyCode === 27) {
                            k.c.d.unbind("mouseup.k mousemove.k keyup.k");

                            if (
                                s.eH
                                && (s.eH() === false)
                            ) return;

                            s.cancel();
                        }
                    }
                )
                .bind(
                    "mouseup.k"
                    , function (e) {
                        k.c.d.unbind('mousemove.k mouseup.k keyup.k');

                        if (
                            s.rH
                            && (s.rH(s.cv) === false)
                        ) return;

                        s.val(s.cv);
                    }
                );

            return this;
        };

        this._xy = function () {
            var o = this.$c.offset();
            this.x = o.left;
            this.y = o.top;
            return this;
        };

        this._listen = function () {

            if (!this.o.readOnly) {
                this.$c
                    .bind(
                        "mousedown"
                        , function (e) {
                            e.preventDefault();
                            s._xy()._mouse(e);
                         }
                    )
                    .bind(
                        "touchstart"
                        , function (e) {
                            e.preventDefault();
                            s._xy()._touch(e);
                         }
                    );
                // disables text field editing
                if (this.o.lockText) this.$.attr('readonly', 'readonly');
                this.listen();
            } else {
                this.$.attr('readonly', 'readonly');
            }

            return this;
        };

        this._configure = function () {

            // Hooks
            if (this.o.draw) this.dH = this.o.draw;
            if (this.o.change) this.cH = this.o.change;
            if (this.o.cancel) this.eH = this.o.cancel;
            if (this.o.release) this.rH = this.o.release;

            if (this.o.displayPrevious) {
                this.pColor = this.h2rgba(this.o.fgColor, "0.4");
                this.fgColor = this.h2rgba(this.o.fgColor, "0.6");
            } else {
                this.fgColor = this.o.fgColor;
            }

            return this;
        };

        this._clear = function () {
            this.$c[0].width = this.$c[0].width;
        };

        // Abstract methods
        this.listen = function () {}; // on start, one time
        this.extend = function () {}; // each time configure triggered
        this.init = function () {}; // each time configure triggered
        this.change = function (v) {}; // on change
        this.val = function (v) {}; // on release
        this.xy2val = function (x, y) {}; //
        this.draw = function () {}; // on change / on release
        this.clear = function () { this._clear(); };

        // Utils
        this.h2rgba = function (h, a) {
            var rgb;
            h = h.substring(1,7)
            rgb = [parseInt(h.substring(0,2),16)
                   ,parseInt(h.substring(2,4),16)
                   ,parseInt(h.substring(4,6),16)];
            return "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + "," + a + ")";
        };

        this.copy = function (f, t) {
            for (var i in f) { t[i] = f[i]; }
        };
    };


    /**
     * k.Dial
     */
    k.Dial = function () {
        k.o.call(this);

        //this.startAngle = null;
        this.startCoord = null;
        this.xy = null;
        //this.radius = null;
        this.len = null;
        this.lineWidth = null;
        this.cursorExt = null;
        this.w2 = null;
        //this.PI2 = 2*Math.PI;

        this.extend = function () {
            this.o = $.extend(
                {
                    bgColor : this.$.data('bgcolor') || '#EEEEEE',
                    //angleOffset : this.$.data('angleoffset') || 0,
                    coordOffset : this.$.data('coordoffset') || 0,
                    //angleArc : this.$.data('anglearc') || 360,
                    coordLen : this.$.data('coordlen') || 100,
                    inline : true
                }, this.o
            );
        };

        this.val = function (v) {
            if (null != v) {
                // this.cv = this.o.stopper ? max(min(v, this.o.max), this.o.min) : v;
                v = this.rachet(this.cv, parseInt(v) - this.cv);
                this.cv = this.o.stopper ? max(min(v, this.o.selectableMax), this.o.selectableMin) : v;
                this.v = this.cv;
                this.$.val(this.v);
                this._draw();
            } else {
                return this.v;
            }
        };

        this.xy2val = function (x, y) {
            var a, ret;

            a = x - this.x;

            ret = parseInt(a * (this.o.max - this.o.min) / (this.endCoord - this.startCoord) + this.o.min, 10);

            this.o.stopper
            && (ret = max(min(ret, this.o.max), this.o.min));

            return ret;
        };

        this.listen = function () {
            // bind MouseWheel
            var s = this,
                mw = function (e) {
                            e.preventDefault();

                            var ori = e.originalEvent
                                ,deltaX = ori.detail || ori.wheelDeltaX
                                ,deltaY = ori.detail || ori.wheelDeltaY
                                ,v = parseInt(s.$.val()) + (deltaX>0 || deltaY>0 ? 1 : deltaX<0 || deltaY<0 ? -1 : 0);

                            if (
                                s.cH
                                && (s.cH(v) === false)
                            ) return;

                            s.val(v);
                        }
                , kval, to, m = 1, kv = {37:-1, 38:1, 39:1, 40:-1};

            this.$
                .bind(
                    "keydown"
                    ,function (e) {
                        var kc = e.keyCode;

                        // numpad support
                        if(kc >= 96 && kc <= 105) {
                            kc = e.keyCode = kc - 48;
                        }

                        kval = parseInt(String.fromCharCode(kc));

                        if (isNaN(kval)) {

                            (kc !== 13)         // enter
                            && (kc !== 8)       // bs
                            && (kc !== 9)       // tab
                            && (kc !== 189)     // -
                            && e.preventDefault();

                            // arrows
                            if ($.inArray(kc,[37,38,39,40]) > -1) {
                                e.preventDefault();

                                var v = parseInt(s.$.val()) + kv[kc] * m;

                                s.o.stopper
                                && (v = max(min(v, s.o.max), s.o.min));

                                if (s.o.selectableSet) { v = s.rachet(parseInt(s.$.val()), kv[kc] * m) };
                                s.change(v);
                                s._draw();

                                // long time keydown speed-up
                                to = window.setTimeout(
                                    function () { m*=2; }
                                    ,30
                                );
                            }
                        }
                    }
                )
                .bind(
                    "keyup"
                    ,function (e) {
                        if (isNaN(kval)) {
                            if (to) {
                                window.clearTimeout(to);
                                to = null;
                                m = 1;
                                s.val(s.$.val());
                            }
                        } else {
                            // kval postcond
                            (s.$.val() > s.o.max && s.$.val(s.o.max))
                            || (s.$.val() < s.o.min && s.$.val(s.o.min));
                        }

                    }
                );

            this.$c.bind("mousewheel DOMMouseScroll", mw);
            this.$.bind("mousewheel DOMMouseScroll", mw)
        };

        this.init = function () {

            if (
                this.v < this.o.min
                || this.v > this.o.max
            ) this.v = this.o.min;

            this.$.val(this.v);
            this.w2 = this.o.width / 2;
            this.cursorExt = this.o.cursor / 100;
            this.xy = this.w2;
            this.lineWidth = this.xy * this.o.thickness;
            //this.radius = this.xy - this.lineWidth / 2;

            //this.o.angleOffset
            //&& (this.o.angleOffset = isNaN(this.o.angleOffset) ? 0 : this.o.angleOffset);

            //this.o.angleArc
            //&& (this.o.angleArc = isNaN(this.o.angleArc) ? this.PI2 : this.o.angleArc);

            // deg to rad
            //this.angleOffset = this.o.angleOffset * Math.PI / 180;
            //this.angleArc = this.o.angleArc * Math.PI / 180;
            
            this.coordOffset = this.o.coordOffset;

            // compute start and end angles
            //this.startAngle = 1.5 * Math.PI + this.angleOffset;
            this.startCoord = this.coordOffset + ((this.o.showHandle) ? (this.o.hRadius * this.lineWidth / 2 + 4) : 0);
            //this.endAngle = 1.5 * Math.PI + this.angleOffset + this.angleArc;
            this.endCoord = this.o.width - this.coordOffset - ((this.o.showHandle) ? (this.o.hRadius * this.lineWidth / 2 + 4) : 0);
            this.coordLen = this.endCoord - this.startCoord;
            
            var s = max(
                            String(Math.abs(this.o.max)).length
                            , String(Math.abs(this.o.min)).length
                            , 2
                            ) + 2;

            this.o.displayInput
                && this.i.css({
                        'width' : ((this.o.width / 2 + 4) >> 0) + 'px'
                        ,'height' : ((this.o.width / 3) >> 0) + 'px'
                        ,'position' : 'absolute'
                        ,'vertical-align' : 'middle'
                        ,'margin-top' : ((this.o.width / 3) >> 0) + 'px'
                        ,'margin-left' : '-' + ((this.o.width * 3 / 4 + 2) >> 0) + 'px'
                        ,'border' : 0
                        ,'background' : 'none'
                        ,'font' : 'bold ' + ((this.o.width / s) >> 0) + 'px Arial'
                        ,'text-align' : 'center'
                        ,'color' : this.o.fgColor
                        ,'padding' : '0px'
                        ,'-webkit-appearance': 'none'
                        })
                || this.i.css({
                        'width' : '0px'
                        ,'visibility' : 'hidden'
                        });
        };

        this.limit = function (v) {
            if (this.o.selectableSet) {
                v = this.nearest(v, this.o.selectableSet);
            }
            if (!((this.o.selectableMin <=  v) && (this.o.selectableMax >= v))) {
                if (this.o.selectableMin > v) {
                    v = this.o.selectableMin;
                } 
                if (this.o.selectableMax < v) {
                    v = this.o.selectableMax;
                }
            }
            return v;
        }
        
        this.nearest = function(v, s) {
            // Binary search and comparison of neighbouring values
            if (typeof(s) === 'undefined' || !s.length) return -1;
            if (this.o.selectableSet.indexOf(v) > 0) return v;
            
            var h = s.length - 1;
            var l = 0;
            
            while (l < h) {
                var m = parseInt((l + h) / 2, 10);
                var element = s[m];
                if (element > v) {
                    h = m - 1;
                } else if (element < v) {
                    l = m + 1;
                } else {
                    return s[m];
                }
            }
            
            var ld = v - s[l - 1];
            var hd = s[h] - v;
            
            return (ld <= hd) ? s[l - 1] : s[h];
        };

        this.rachet = function (v, delta) {
            if (typeof(this.o.selectableSet) === 'undefined') return v;
            if (v > this.o.selectableMax) return this.o.selectableMax;
            if (v < this.o.selectableMin) return this.o.selectableMin;
            if (delta === 0) return v;
            
            v = this.nearest(v, this.o.selectableSet);
            
            if (this.o.selectableSet.indexOf(v) + delta > this.o.selectableSet.length - 1) {
                return this.o.selectableSet[ this.o.selectableSet.length - 1 ];
            } else if (this.o.selectableSet.indexOf(v) + delta < 0 ) {
                return this.o.selectableSet[ 0 ];
            }
            
            return this.o.selectableSet[ this.o.selectableSet.indexOf(v) + delta ];
        }

        this.change = function (v) {
            this.cv = this.limit(v);
            this.$.val(this.limit(v));
        };

        this.angle = function (v) {
            return (v - this.o.min) * this.angleArc / (this.o.max - this.o.min);
        };
        
        this.coord = function (v) {
            return (v - this.o.min) * (this.endCoord - this.startCoord) / (this.o.max - this.o.min);
        };

        this.draw = function () {

            var c = this.g                  // context
                , co = this.coord(this.cv)  // Coord
                , sac = this.startCoord     // Start coord
                , eac = sac + co
                , sa, ea                    // Previous coords
                , r = 1;

            c.lineWidth = this.lineWidth;
            
            this.o.cursor
                && (sac = eac - (this.cursorExt * this.o.coordLen))
                && (eac = eac + (this.cursorExt * this.o.coordLen));
            
            c.beginPath();
                if (this.o.bgTexture) {
                    c.strokeStyle = c.createPattern(this.o.bgTexture, "repeat");
                } else {
                    c.strokeStyle = this.o.bgColor;
                }
                c.moveTo(this.startCoord, 3 * c.lineWidth / 2);
                c.lineTo(this.endCoord, 3 * c.lineWidth / 2);
            c.stroke();
            
            if (this.o.displayUnselectable) {
                ea = this.endCoord;
                sa = this.startCoord + this.coord(this.o.selectableMax);
                
                c.beginPath();
                    if (this.o.mTexture) {
                        c.strokeStyle = c.createPattern(this.o.mTexture, "repeat");
                    } else {
                        c.strokeStyle = this.o.mColor;
                    }
                    c.moveTo(sa, 3 * c.lineWidth / 2);
                    c.lineTo(ea, 3 * c.lineWidth / 2);
                c.stroke();
            }

            if (this.o.displayPrevious) {
                ea = this.startCoord + this.coord(this.v);
                sa = this.startCoord;
                this.o.cursor
                    && (sa = ea - this.cursorExt)
                    && (ea = ea + this.cursorExt);

                c.beginPath();
                    c.strokeStyle = this.pColor;
                    c.moveTo(sa, 3 / 2 * c.lineWidth);
                    c.lineTo(ea, 3 / 2 * c.lineWidth);
                c.stroke();
                r = (this.cv == this.v);
            }

            c.beginPath();
                c.strokeStyle = r ? this.o.fgColor : this.fgColor ;
                c.moveTo(sac, 3 / 2 * c.lineWidth);
                c.lineTo(eac, 3 / 2 * c.lineWidth);
            c.stroke();
            
            if (this.o.displaySegmented) {
                var i = 0,
                    x = 0;

                c.lineWidth = 2;

                if (typeof(this.o.segmentSkip) !== 'undefined') {
                    if (typeof(this.o.selectableSet) !== 'undefined') {
                        for (i = 0; i < (this.o.selectableSet.length - 1); i++) {
                            if (this.o.selectableSet[i + 1] - this.o.selectableSet[i] < this.o.segmentSkip ) {
                                this.o.segmentSkip = this.o.selectableSet[i + 1] - this.o.selectableSet[i];
                            }
                        }
                    }
                }
                
            
                for (i = 0; i < (this.o.selectableMax / this.o.segmentSkip) - 1; i++) {
                    x = this.o.selectableMin + (this.o.segmentSkip * i);
                    c.beginPath();
                        c.strokeStyle = this.o.bColor;
                        c.moveTo(this.startCoord + this.coord(x), this.lineWidth + 1/4 * this.lineWidth);
                        c.lineTo(this.startCoord + this.coord(x), 2 * this.lineWidth - 1/4 * this.lineWidth);
                    c.stroke();
                }
            }
            
            if (this.o.bColor) {
                // Slider border
                c.lineWidth = 1;
                c.strokeStyle = this.o.bColor;
                c.roundRect(this.startCoord, this.lineWidth, this.endCoord - this.startCoord, this.lineWidth, this.o.bRadius).stroke();
                c.lineWidth = this.lineWidth;
            }
            
            if (this.o.showHandle) {
                // Handle
                c.beginPath();
                    c.fillStyle = this.o.hColor;
                    c.arc( eac, 3 / 2 * this.lineWidth, this.o.hRadius * this.lineWidth / 2, 0, 2 * Math.PI, false);
                c.closePath();
                c.fill();
                
                // Border
                c.lineWidth = 1;
                c.beginPath();
                    c.strokeStyle = this.o.hbColor;
                    c.arc( eac, 3 / 2 * this.lineWidth, this.o.hRadius * this.lineWidth / 2, 0, 2 * Math.PI, false);
                c.stroke();
                c.lineWidth = this.lineWidth;
            }
        };

        this.cancel = function () {
            this.val(this.v);
        };
    };

    $.fn.dial = $.fn.knob = function (o) {
        return this.each(
            function () {
                var d = new k.Dial();
                d.o = o;
                d.$ = $(this);
                d.run();
            }
        ).parent();
    };

})(jQuery);
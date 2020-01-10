(function() {
    "use strict";
    window.Util = {
        randint: function(n) {
            return ~~(Math.random() * n)
        }
    };
    if (!("bind" in Function)) {
        Function.prototype.bind = function(context) {
            var self = this;
            return function() {
                return self.apply(context, arguments)
            }
        }
    }
    var $ = Class.extend({
        init: function(id) {
            this.elem = document.getElementById(id)
        }
    });
    var addEvent = function(elem, event, callback) {
        if (document.addEventListener) {
            return function(elem, type, callback) {
                elem.addEventListener(type, callback, false)
            }
        } else {
            return function(elem, type, callback) {
                elem.attachEvent("on" + type, function(e) {
                    e = e || event;
                    e.preventDefault = e.preventDefault || function() {
                        this.returnValue = false
                    };
                    e.stopPropagation = e.stopPropagation || function() {
                        this.cancelBubble = true
                    };
                    return callback.call(e.target || e.srcElement, e)
                })
            }
        }
    }();
    var events = ("mousemove mouseover mouseout mousedown mouseup click touchstart " + "dblclick focus blur submit change").split(" ");
    for (var i = 0; i < events.length; i++) {
        var event = events[i];
        $.prototype[event] = function(event) {
            return function(selector, fn) {
                if (typeof selector == "function") {
                    addEvent(this.elem, event, selector)
                } else {
                    addEvent(this.elem, event, function(e) {
                        var elem = e.target || e.srcElement;
                        if (elem.tagName.toLowerCase() == selector) {
                            e.stopPropagation();
                            fn.call(elem, e)
                        }
                    }, false)
                }
            }
        }(event)
    }
    Util.fullScreen = function() {
        if (document.documentElement.scrollHeight < window.outerHeight / window.devicePixelRatio) {
            document.body.style.height = window.outerHeight / window.devicePixelRatio + 1 + "px";
            setTimeout(function() {
                window.scrollTo(1, 1)
            }, 0)
        } else {
            window.scrollTo(1, 1)
        }
    };
    Util.getContext = function(canvas) {
        if (!canvas.getContext && window.G_vmlCanvasManager) {
            G_vmlCanvasManager.initElement(canvas)
        }
        return canvas.getContext("2d")
    };
    Util.extend = function(orig, obj) {
        var attr;
        for (attr in obj) {
            if (obj.hasOwnProperty(attr) && !(attr in orig)) {
                orig[attr] = obj[attr]
            }
        }
        return orig
    };
    Util.calcPieces = function(options) {
        var w = options.image.width,
            h = options.image.height,
            select = document.getElementById("set-parts"),
            selectedIndex = 0,
            option, size, cols, rows, parts;
        select.innerHTML = "";
        for (var i = 0; i < options.options.length; i += 1) {
            var size = ~~Math.sqrt(w * h / options.options[i]),
                cols = ~~(w / size),
                rows = ~~(h / size);
            while (cols * rows < options.options[i]) {
                size--;
                cols = ~~(w / size);
                rows = ~~(h / size)
            }
            if (parts != cols * rows) {
                parts = cols * rows;
                option = document.createElement("option");
                option.value = options.options[i];
                option.innerHTML = options.template.replace("%d", parts);
                select.appendChild(option);
                if (options.options[i] === options.selected) option.selected = true
            }
        }
    };
    Util.addEvent = addEvent;
    Util.$ = function() {
        var _ = $();
        return function(id) {
            _.elem = document.getElementById(id);
            return _
        }
    }()
})();
(function() {
    "use strict";
    var ctx = Util.getContext(document.createElement("canvas")),
        testCtx = ctx,
        abs = Math.abs;
    var DEGREE = Math.PI / 180;
    var ctxFix = Util.getContext(document.createElement("canvas"));

    function getPixelRatio() {
        return window.devicePixelRatio || 1
    }
    var ua = navigator.userAgent,
        isAndroid = ua.match(/android/i),
        isIOS = ua.match(/iphone|ipad|ipod/i),
        isWindowMobile = ua.match(/Windows Phone/i) || ua.match(/iemobile/i),
        isDesktop = !isAndroid && !isIOS && !isWindowMobile;
    var SNAP_DST = 20;

    function check_position(f1, f2) {
        if (f1.rotation % 360 || f2.rotation % 360 || f2.hide || f1.hide || f1.row != f2.row && f1.col != f2.col) {
            return
        }
        var diff_x = f1.tx - f2.tx,
            diff_y = f1.ty - f2.ty,
            diff_col = f1.col - f2.col,
            diff_row = f1.row - f2.row,
            w = f1.width,
            h = f1.height,
            s = f1.size;
        if ((diff_col == -1 && diff_x < 0 && abs(diff_x + w) < SNAP_DST || diff_col == 1 && diff_x >= 0 && abs(diff_x - w) < SNAP_DST) && (diff_y <= SNAP_DST && diff_y >= -SNAP_DST)) {
            return [f1.col > f2.col ? -abs(diff_x) + w : abs(diff_x) - w, f2.ty - f1.ty]
        } else if ((diff_row == -1 && diff_y < 0 && abs(diff_y + h) < SNAP_DST || diff_row == 1 && diff_y >= 0 && abs(diff_y - h) < SNAP_DST) && (diff_x <= SNAP_DST && diff_x >= -SNAP_DST)) {
            return [f2.tx - f1.tx, f1.row > f2.row ? -abs(diff_y) + h : abs(diff_y) - h]
        }
    }
    var Piece = Cevent.Shape.extend({
            type: "piece",
            init: function(x, y, img, width, height, edges, flat) {
                this.flat = flat;
                this._super(x, y);
                this.img = img;
                this.originalImg = img;
                this.size = Math.max(width, height);
                this.width = width;
                this.height = height;
                this.diagonal = ~~Math.sqrt(width * width + height * height);
                this.edges = edges;
                this.lastRotation = 0;
                var half_s = this.size / 2;
                this.tx = this.x + this.width / 2;
                this.ty = this.y + this.height / 2;
                this.x = -this.width / 2;
                this.y = -this.height / 2
            },
            draw_path: function(ctx) {
                var s = this.size,
                    fn, i = 0;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                for (; i < 4; i++) {
                    fn = this.edges[i];
                    s = i % 2 ? this.height : this.width;
                    var w = i % 2 ? this.height : this.width;
                    var h = i % 2 ? this.width : this.height;
                    var x = i % 2 ? this.y : this.x;
                    var y = i % 2 ? this.x : this.y;
                    if (fn) {
                        var cx = this[fn](ctx, w, h, x, y)
                    } else {
                        ctx.lineTo(x + s, y)
                    }
                    ctx.rotate(Math.PI / 2)
                }
                ctx.closePath()
            },
            render: function(ox, oy) {
                ox = ox || this.ox || 0;
                oy = oy || this.oy || 0;
                this.originalTX = this.originalTX || this.tx;
                this.originalTY = this.originalTY || this.ty;
                var ctx = this.ctx || Util.getContext(document.createElement("canvas")),
                    s = this.size + .5;
                ctxFix.canvas.width = ctx.canvas.width = s * 2;
                ctxFix.canvas.height = ctx.canvas.height = s * 2;
                ctxFix.save();
                ctx.save();
                this.applyStyle(ctx);
                ctxFix.lineWidth = .5;
                ctx.lineWidth = .5;
                ctx.translate(this.width, this.height);
                ctx.rotate(this.rotation * DEGREE);
                ctxFix.translate(this.width, this.height);
                ctxFix.rotate(this.rotation * DEGREE);
                this.draw_path(ctx);
                this.draw_path(ctxFix);
                ctx.fill();
                ctxFix.drawImage(this.originalImg, -this.originalTX - ox, -this.originalTY - oy);
                if (this.stroke) {
                    ctxFix.globalCompositeOperation = "lighter";
                    ctxFix.shadowOffsetY = 1.5;
                    ctxFix.shadowOffsetX = 1.5;
                    ctxFix.shadowBlur = 0;
                    ctxFix.shadowColor = "rgba(255, 255, 255, .4)";
                    ctxFix.lineWidth = 1.5;
                    ctxFix.strokeStyle = "rgba(0, 0, 0, .4)";
                    ctxFix.stroke();
                    ctxFix.globalCompositeOperation = "darken";
                    ctxFix.shadowBlur = 1;
                    ctxFix.shadowOffsetY = -1;
                    ctxFix.shadowOffsetX = -1;
                    ctxFix.shadowBlur = 2;
                    ctxFix.shadowColor = "rgba(0, 0, 0, .2)";
                    ctxFix.lineWidth = 2;
                    ctxFix.strokeStyle = "rgba(0, 0, 0, .4)";
                    ctxFix.stroke();
                    ctxFix.clip()
                }
                ctxFix.restore();
                ctx.restore();
                ctx.globalCompositeOperation = "source-in";
                if (ctx.globalCompositeOperation !== "source-in") {
                    ctx.globalCompositeOperation = "source-atop"
                }
                ctx.drawImage(ctxFix.canvas, 0, 0);
                if (!this.ctx) this.tx += this.offset;
                this.img = ctx.canvas;
                this.ctx = ctx;
                this.ox = ox;
                this.oy = oy
            },
            outside: function(ctx, w, h, cx, cy) {
                if (this.flat) return ctx.lineTo(cx + w, cy);
                ctx.lineTo(cx + w * .34, cy);
                ctx.bezierCurveTo(cx + w * .5, cy, cx + w * .4, cy + h * -.15, cx + w * .4, cy + h * -.15);
                ctx.bezierCurveTo(cx + w * .3, cy + h * -.3, cx + w * .5, cy + h * -.3, cx + w * .5, cy + h * -.3);
                ctx.bezierCurveTo(cx + w * .7, cy + h * -.3, cx + w * .6, cy + h * -.15, cx + w * .6, cy + h * -.15);
                ctx.bezierCurveTo(cx + w * .5, cy, cx + w * .65, cy, cx + w * .65, cy);
                ctx.lineTo(cx + w, cy)
            },
            inside: function(ctx, w, h, cx, cy) {
                if (this.flat) return ctx.lineTo(cx + w, cy);
                ctx.lineTo(cx + w * .35, cy);
                ctx.bezierCurveTo(cx + w * .505, cy + .05, cx + w * .405, cy + h * .155, cx + w * .405, cy + h * .1505);
                ctx.bezierCurveTo(cx + w * .3, cy + h * .3, cx + w * .5, cy + h * .3, cx + w * .5, cy + h * .3);
                ctx.bezierCurveTo(cx + w * .7, cy + h * .29, cx + w * .6, cy + h * .15, cx + w * .6, cy + h * .15);
                ctx.bezierCurveTo(cx + w * .5, cy, cx + w * .65, cy, cx + w * .65, cy);
                ctx.lineTo(cx + w, cy)
            },
            draw: function(ctx) {
                if (this.hide) {
                    return
                }
                var x = this.x - this.width / 2 - .5;
                var y = this.y - this.height / 2 - .5;
                if (isDesktop) {
                    this.setTransform(ctx);
                    ctx.drawImage(this.img, x, y);
                    return
                }
                if (this.rotation !== this.lastRotation) {
                    this.render();
                    this.lastRotation = this.rotation
                }
                ctx.drawImage(this.img, x + this.tx, y + this.ty)
            },
            check: function(other) {
                var r;
                if (other.type == "piece") {
                    r = check_position(this, other)
                } else {
                    var i, l = other.pieces.length;
                    for (i = 0; i < l; i++) {
                        if (r = check_position(this, other.pieces[i])) {
                            break
                        }
                    }
                }
                if (r) {
                    this.rmove(r[0], r[1])
                }
                return r
            },
            hitTest: function(point) {
                if (this.hide) {
                    return
                }
                this.setTransform(ctx);
                this.draw_path(ctx);
                return ctx.isPointInPath(point.x * getPixelRatio(), point.y * getPixelRatio())
            }
        }),
        Group = Cevent.Shape.extend({
            type: "group",
            init: function() {
                this.pieces = [];
                this._super(0, 0)
            },
            draw: function(ctx) {
                if (this.hide) {
                    return
                }
                var i, l = this.pieces.length;
                for (i = 0; i < l; i++) {
                    this.pieces[i].draw(ctx)
                }
            },
            hitTest: function(point) {
                var i, l = this.pieces.length;
                for (i = 0; i < l; i++) {
                    if (this.pieces[i].hitTest(point)) {
                        return true
                    }
                }
            },
            check: function(other) {
                var i, l = this.pieces.length,
                    r;
                if (other.type == "piece") {
                    for (i = 0; i < l; i++) {
                        if (r = check_position(this.pieces[i], other)) {
                            this.rmove(r[0], r[1]);
                            return true
                        }
                    }
                } else {
                    var j, l2 = other.pieces.length;
                    for (i = 0; i < l; i++) {
                        for (j = 0; j < l2; j++) {
                            if (r = check_position(this.pieces[i], other.pieces[j])) {
                                this.rmove(r[0], r[1]);
                                return true
                            }
                        }
                    }
                }
            },
            rmove: function(x, y) {
                var i, l = this.pieces.length;
                for (i = 0; i < l; i++) {
                    this.pieces[i].rmove(x, y)
                }
                this.tx = this.minPieceX.tx;
                this.ty = this.minPieceY.ty
            },
            add: function() {
                this.pieces = this.pieces.concat.apply(this.pieces, arguments);
                this.minPieceX = min(this.pieces, "tx");
                this.minPieceY = min(this.pieces, "ty");
                this.width = max(this.pieces, "tx").tx - this.minPieceX.tx;
                this.height = max(this.pieces, "ty").ty - this.minPieceY.ty;
                this.width += this.pieces[0].width;
                this.height += this.pieces[0].height;
                this.x = this.pieces[0].x;
                this.y = this.pieces[0].y;
                this.tx = this.minPieceX.tx;
                this.ty = this.minPieceY.ty
            }
        });

    function max(array, attr) {
        var max = array[0][attr];
        var index = 0;
        for (var i = 1; i < array.length; i++) {
            if (array[i][attr] > max) {
                max = array[i][attr];
                index = i
            }
        }
        return array[index]
    }

    function min(array, attr) {
        var min = array[0][attr];
        var index = 0;
        for (var i = 1; i < array.length; i++) {
            if (array[i][attr] < min) {
                min = array[i][attr];
                index = i
            }
        }
        return array[index]
    }
    Cevent.register("group", Group);
    Cevent.register("piece", Piece)
})();
(function() {
    "use strict";
    var IN = "inside",
        OUT = "outside",
        NONE = null,
        DEFAULT_IMAGE, EDGES = [IN, OUT],
        uuid = 0,
        default_opts = {
            spread: .7,
            offsetTop: 0,
            maxWidth: 705,
            maxHeight: 470,
            defaultImage: "images/puzzle/scottwills_meercats.jpg",
            piecesNumberTmpl: "%d Pieces",
            redirect: "",
            border: true,
            defaultPieces: 10,
            shuffled: false,
            rotatePieces: true,
            numberOfPieces: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
            squarePieces: false
        },
        TOOLBAR_HEIGHT = 45,
        docElement = document.documentElement,
        pixelRatio = window.devicePixelRatio || 1;

    function random_edge() {
        return EDGES[Util.randint(2)]
    }

    function $(id) {
        return document.getElementById(id)
    }

    function getPixelRatio() {
        return window.devicePixelRatio || 1
    }
    window.jigsaw = {};
    jigsaw.Jigsaw = Class.extend({
        init: function(opts) {
            var eventBus = new EventEmitter,
                self = this;
            this.opts = opts = Util.extend(opts || {}, default_opts);
            this.max_width = opts.maxWidth;
            this.max_height = opts.maxHeight;
            $("redirect-form").action = opts.redirect;
            DEFAULT_IMAGE = opts.defaultImage;
            this.eventBus = eventBus;
            this.ce = new Cevent("canvas");
            this.ui = new jigsaw.UI(eventBus, opts.defaultPieces || 10);
            this.tmp_img = document.createElement("img");
            this.img = document.getElementById("image");
            this.ctx = Util.getContext(this.img);
            this.preview = document.getElementById("image-preview");
            this.previewCtx = Util.getContext(this.preview);
            this.parts = opts.defaultPieces || 10;
            var showPreview = false;
            this.ce.beforeDraw(function() {
                if (showPreview) self.ce.ctx.drawImage(self.preview, self.ce.cv.width / 2 - self.preview.width / 2, 0)
            });
            eventBus.on(jigsaw.Events.SHOW_PREVIEW, function() {
                showPreview = !showPreview;
                self.ce.redraw()
            });
            this.tmp_img.onload = function() {
                self.original = this;
                self.draw_image(this);
                Util.calcPieces({
                    image: self.img,
                    template: self.opts.piecesNumberTmpl,
                    selected: self.parts,
                    options: self.opts.numberOfPieces
                });
                self.render()
            };
            this.tmp_img.onerror = function() {
                if (DEFAULT_IMAGE) {
                    self.set_image(DEFAULT_IMAGE)
                }
            };
            jigsaw_events(this.ce, eventBus, this.opts.rotatePieces);
            eventBus.on(jigsaw.Events.JIGSAW_COMPLETE, function() {
                self.ui.stop_clock();
                if (opts.redirect) {
                    self.redirect()
                } else {
                    self.ui.show_time()
                }
            });
            if (opts.shuffled) {
                eventBus.on(jigsaw.Events.RENDER_FINISH, this.shuffle.bind(this))
            }
            eventBus.on(jigsaw.Events.PARTS_NUMBER_CHANGED, this.set_parts.bind(this));
            eventBus.on(jigsaw.Events.RENDER_REQUEST, this.render.bind(this));
            eventBus.on(jigsaw.Events.JIGSAW_SHUFFLE, this.shuffle.bind(this));
            eventBus.on(jigsaw.Events.JIGSAW_SET_IMAGE, this.set_image.bind(this));
            eventBus.on(jigsaw.Events.SHOW_EDGE, function() {
                self.ce.find("#middle").attr("hide", true);
                self.ce.find("#edge").attr("hide", false);
                self.ce.redraw()
            });
            eventBus.on(jigsaw.Events.SHOW_MIDDLE, function() {
                self.ce.find("#middle").attr("hide", false);
                self.ce.find("#edge").attr("hide", true);
                self.ce.redraw()
            });
            eventBus.on(jigsaw.Events.SHOW_ALL, function() {
                self.ce.find("*").attr("hide", false);
                self.ce.redraw()
            });
            Util.addEvent(window, "resize", this.resize.bind(this));
            this.resize();
            this.set_image()
        },
        resize: function resizeView() {
            var canvas = this.ce.cv,
                maxWidth = docElement.clientWidth,
                maxHeight = docElement.clientHeight - TOOLBAR_HEIGHT;
            canvas.width = maxWidth * getPixelRatio();
            canvas.height = maxHeight * getPixelRatio();
            canvas.style.width = maxWidth + "px";
            canvas.style.height = maxHeight + "px";
            this.ce.redraw();
            if (Cevent.isTouchDevice) {
                Util.fullScreen()
            }
        },
        redirect: function() {
            $("t").value = this.ui.time();
            $("p").value = this.parts;
            $("redirect-form").submit()
        },
        set_parts: function(n) {
            this.parts = n
        },
        set_image: function(src) {
            this.ce.cv.className = "loading";
            this.tmp_img.src = src || DEFAULT_IMAGE
        },
        draw_image: function(img, w, h) {
            var max_w = w || this.max_width * getPixelRatio(),
                max_h = h || this.max_height * getPixelRatio(),
                width, height, ctx = this.ctx;
            if (max_w > window.innerWidth || max_h > window.innerHeight - 50) {
                var ratio = Math.min(window.innerWidth / max_w, (window.innerHeight - 50) / max_h);
                max_w *= ratio;
                max_h *= ratio
            }
            if (img.width > max_w || img.height > max_h) {
                var rate = Math.min(max_w / img.width, max_h / img.height);
                width = ~~(img.width * rate) * getPixelRatio();
                height = ~~(img.height * rate) * getPixelRatio();
                ctx.canvas.width = width;
                ctx.canvas.height = height;
                ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, width, height)
            } else {
                ctx.canvas.width = img.width * getPixelRatio();
                ctx.canvas.height = img.height * getPixelRatio();
                ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, ctx.canvas.width, ctx.canvas.height)
            }
        },
        clear: function() {
            this.ce._shapes = []
        },
        shuffle: function() {
            var T = this.ce.getAll("piece");
            if (!this.__pieces) {
                return
            } else {
                this.ce._shapes = T = this.__pieces.slice(0)
            }
            this.ce.clear();
            var i, l = T.length,
                F, s = T[0].size,
                ratio = this.opts.spread,
                width = document.documentElement.clientWidth * getPixelRatio(),
                height = (document.documentElement.clientHeight - 50) * getPixelRatio(),
                w = width * ratio,
                h = height * ratio,
                padx = ~~((width - w) / 2),
                pady = ~~((height - h) / 2);
            for (i = 0; i < l; i++) {
                F = T[i];
                F.tx = Util.randint(w) + F.tx % 1 + padx;
                F.ty = Util.randint(h) + F.tx % 1 + pady;
                if (this.opts.rotatePieces) {
                    F.rotation = Util.randint(4) * 90
                }
            }
            if (this.opts.shuffled) {
                this.ce.cv.className = "";
                this.ui.init_clock()
            }
            this.ce.find("*").attr({
                hide: false
            });
            this.ce.shuffled = true;
            this.ce.redraw()
        },
        render: function() {
            if (this.opts.shuffled) {
                this.ce.cv.className = "loading";
                this.ce.clear();
                this.ui.stop_clock()
            } else {
                this.ce.cv.className = ""
            }
            this.ce.shuffled = false;
            var top, right, bottom, left, current_right = [],
                last_right = [],
                w = this.img.width,
                h = this.img.height,
                size = ~~Math.sqrt(w * h / this.parts),
                cols = ~~(w / size),
                rows = ~~(h / size),
                i = 0,
                j = 0,
                flag = ++uuid,
                offset;
            this.flag = flag;
            while (cols * rows < this.parts) {
                size--;
                cols = ~~(w / size);
                rows = ~~(h / size)
            }
            var width = ~~(w / cols);
            var height = ~~(h / rows);
            width = width % 2 ? width : width - 1;
            height = height % 2 ? height : height - 1;
            offset = ~~(document.documentElement.clientWidth / 2 * getPixelRatio() - width * cols / 2);
            this.clear();
            var ox = ~~((w - cols * width) / 2),
                oy = ~~((h - rows * height) / 2);
            ox = ox >= 0 ? ox : 0;
            oy = oy >= 0 ? oy : 0;
            this.preview.style.marginTop = this.opts.offsetTop + "px";
            this.preview.width = width * cols;
            this.preview.height = height * rows;
            this.preview.style.width = this.preview.width / getPixelRatio() + "px";
            this.preview.style.height = this.preview.height / getPixelRatio() + "px";
            this.previewCtx.globalAlpha = .3;
            this.previewCtx.drawImage(this.img, ox, oy, width * cols, height * rows, 0, 0, width * cols, height * rows);
            (function F() {
                if (i < cols && flag == this.flag) {
                    if (j < rows) {
                        top = j == 0 ? NONE : bottom == IN ? OUT : IN;
                        right = i == cols - 1 ? NONE : random_edge();
                        bottom = j == rows - 1 ? NONE : random_edge();
                        left = i == 0 ? 0 : last_right[j] == IN ? OUT : IN;
                        this.ce.piece(width * i, height * j + this.opts.offsetTop, window.G_vmlCanvasManager ? this.tmp_img : this.img, width, height, [top, right, bottom, left], this.opts.squarePieces).attr({
                            col: i,
                            row: j,
                            offset: offset,
                            stroke: this.opts.border ? "black" : ""
                        }).get(-1).render(ox, oy - this.opts.offsetTop);
                        if (!this.opts.shuffled) {
                            this.ce.redraw()
                        }
                        if (j == 0 || i == 0 || i == cols - 1 || j == rows - 1) {
                            this.ce.addId("edge")
                        } else {
                            this.ce.addId("middle")
                        }
                        current_right.push(right);
                        j++
                    } else {
                        i++;
                        j = 0;
                        last_right = current_right;
                        current_right = []
                    }
                    setTimeout(F.bind(this), 20);
                    return
                } else if (this.flag == flag) {
                    this.__pieces = this.ce.get().slice(0);
                    this.ce.redraw();
                    this.eventBus.emit(jigsaw.Events.RENDER_FINISH)
                }
            }).bind(this)()
        }
    });

    function jigsaw_events(ce, eventBus, rotate) {
        ce.drag("*", {
            start: function(c, e) {
                c.cv.style.cursor = "move";
                c.lastX *= getPixelRatio();
                c.lastY *= getPixelRatio();
                this.handleX = c.lastX - this.tx;
                this.handleY = c.lastY - this.ty
            },
            move: function(c, e) {
                c.x *= getPixelRatio();
                c.y *= getPixelRatio();
                c.x += c.lastX - this.tx - this.handleX;
                c.y += c.lastY - this.ty - this.handleY
            },
            afterMove: function(c, e) {
                var pwidth = ~~(this.width / 2);
                var pheight = ~~(this.height / 2);
                var posx = this.x + this.tx + pwidth;
                var posy = this.y + this.ty + pheight;
                var width = c.cv.width;
                var height = c.cv.height;
                if (this.rotation / 45 % 2) {
                    pwidth = this.diagonal / 2;
                    pheight = this.diagonal / 2
                }
                var x = 0;
                var y = 0;
                if (posx - pwidth < 0) {
                    x = posx - pwidth
                } else if (posx + pwidth > width) {
                    x = posx + pwidth - width
                }
                if (posy - pheight < 0) {
                    y = posy - pheight
                } else if (posy + pheight > height) {
                    y = posy + pheight - height
                }
                this.rmove(-x, -y)
            },
            end: function(c, e) {
                c.cv.style.cursor = "default";
                if (!c.shuffled) {
                    return
                }
                var all = c.getAll("piece").concat(c.getAll("group")),
                    i = 0,
                    l = all.length,
                    that = this;
                for (; i < l; i++) {
                    if (all[i] === this) {
                        continue
                    }
                    if (that.check(all[i])) {
                        c.remove(that);
                        c.remove(all[i]);
                        c._curHover = c.group().get(-1);
                        c._curHover.add(that.pieces || that, all[i].pieces || all[i]);
                        that = c._curHover;
                        c.focused = null
                    }
                }
                if (!ce.getAll("piece").length && ce.getAll("group").length == 1 && ce.shuffled) {
                    ce.shuffled = false;
                    eventBus.emit(jigsaw.Events.JIGSAW_COMPLETE)
                }
                if (that.type == "group") {
                    c.remove(that);
                    c._shapes.unshift(that)
                }
            }
        }).focus("*", function(c, e) {
            c.remove(this);
            c._shapes.push(this)
        });
        Util.addEvent(ce.cv, "contextmenu", function(e) {
            if (rotate && ce.focused) {
                ce.focused.rotation = (ce.focused.rotation + 45) % 360;
                ce.redraw()
            }
            e.preventDefault()
        });
        if (!rotate) {
            return
        }
        ce.keydown("right", function() {
            if (this.focused) {
                this.focused.rotation = (this.focused.rotation + 45) % 360
            }
            return false
        }).keydown("left", function() {
            if (this.focused) {
                this.focused.rotation = (this.focused.rotation - 45) % 360
            }
            return false
        });
        ce.tap("*", function(c, e) {
            if (Cevent.isTouchDevice && ce.focused) {
                ce.focused.rotation = (ce.focused.rotation + 45) % 360;
                ce.redraw()
            }
        })
    }
    EventEmitter.mixin(jigsaw.Jigsaw)
})();
(function() {
    "use strict";
    var $ = function(id) {
            return document.getElementById(id)
        },
        uuid = 0,
        deviceRatio = window.devicePixelRatio || 1;
    jigsaw.UI = Class.extend({
        init: function(eventBus, parts) {
            var self = this;
            this.eventBus = eventBus;
            this.clock = $("clock");
            init_events(this, eventBus);
            eventBus.on(jigsaw.Events.JIGSAW_SHUFFLE, this.init_clock.bind(this));
            eventBus.on(jigsaw.Events.SHOW_PREVIEW, this.show_preview.bind(this));
            eventBus.on(jigsaw.Events.SHOW_HELP, this.show_help.bind(this));
            eventBus.on(jigsaw.Events.SHOW_FILEPICKER, this.show_filepicker.bind(this))
        },
        stop_clock: function() {
            uuid++
        },
        init_clock: function() {
            var self = this;
            this.ini = (new Date).getTime();
            this.uuid = uuid;
            (function F() {
                if (self.uuid == uuid) {
                    self.clock.innerHTML = self.time();
                    setTimeout(F, 1e3)
                }
            })()
        },
        show_preview: function() {
            var canvas = $("image-preview");
            canvas.className = canvas.className == "show" ? "hide" : "show";
            canvas.style.marginLeft = -(canvas.width / 2 / deviceRatio) + "px"
        },
        show_time: function() {
            this.show_modal("congrat");
            $("time").innerHTML = this.clock.innerHTML;
            $("time-input").value = this.clock.innerHTML
        },
        time: function() {
            var t = ~~(((new Date).getTime() - this.ini) / 1e3),
                s = t % 60,
                m = ~~(t / 60),
                h = ~~(m / 60);
            m %= 60;
            return (h > 9 ? h : "0" + h) + ":" + (m > 9 ? m : "0" + m % 60) + ":" + (s > 9 ? s : "0" + s)
        },
        show_modal: function(id) {
            game.Modal.open(id)
        },
        show_filepicker: function() {
            this.show_modal("create-puzzle")
        },
        show_help: function() {
            this.show_modal("help")
        }
    });

    function init_events(self, eventBus) {
        function handleFiles(files) {
            var file = files[0];
            if (!file.type.match(/image.*/)) {
                $("image-error").style.display = "block";
                return
            }
            var reader = new FileReader;
            reader.onloadend = function(e) {
                eventBus.emit(jigsaw.Events.JIGSAW_SET_IMAGE, this.result);
                close_lightbox()
            };
            reader.readAsDataURL(file)
        }
        if (window.FileReader && (new FileReader).onload === null) {
            $("create").style.display = "block";
            Util.$("image-input").change(function() {
                handleFiles(this.files)
            });
            if ("ondragenter" in window && "ondrop" in window) {
                $("dnd").style.display = "block";
                document.addEventListener("dragenter", function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    return false
                }, false);
                document.addEventListener("dragover", function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    return false
                }, false);
                document.addEventListener("drop", function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    var dt = e.dataTransfer;
                    handleFiles(dt.files)
                }, false)
            }
        }

        function close_lightbox() {
            game.Modal.close();
            return false
        }
        Util.$("set-parts").change(function() {
            eventBus.emit(jigsaw.Events.PARTS_NUMBER_CHANGED, +this.value);
            eventBus.emit(jigsaw.Events.RENDER_REQUEST)
        });
        Cevent.addEventListener("game-options", "mousedown", function(e) {
            var target = e.target || e.srcElement;
            if (jigsaw.Events[target.id]) {
                e.preventDefault();
                e.stopPropagation();
                eventBus.emit(jigsaw.Events[target.id])
            }
        })
    }
})();
(function() {
    jigsaw.Events = {
        PARTS_NUMBER_CHANGED: "PartsNumberChanged",
        RENDER_REQUEST: "RenderRequestEvent",
        RENDER_FINISH: "RenderFinishEvent",
        JIGSAW_RENDERED: "JigsawRenderedEvent",
        JIGSAW_SET_IMAGE: "JigsawSetImageEvent",
        JIGSAW_SHUFFLE: "JigsawShuffleEvent",
        SHOW_PREVIEW: "JigsawShowPreview",
        SHOW_HELP: "JigsawShowHelp",
        SHOW_FILEPICKER: "JigsawShowFilepicker",
        SHOW_EDGE: "ShowEdgeEvent",
        SHOW_MIDDLE: "ShowMiddleEvent",
        SHOW_ALL: "ShowAllEvent",
        JIGSAW_COMPLETE: "JigsawCompleteEvent"
    }
})();
(function(document, window, undefined) {
    "use strict";
    var $ = function(id) {
            return document.getElementById(id)
        },
        $modal = $("modal-window"),
        $msg = $("modal-window-msg"),
        $close = $("modal-window-close"),
        $overlay = $("overlay");

    function replace(text, tmpl) {
        var i;
        for (i in tmpl) {
            if (tmpl.hasOwnProperty(i)) {
                text = text.replace(new RegExp("{{" + i + "}}", "gi"), tmpl[i])
            }
        }
        return text
    }

    function showModal(id, tmpl) {
        var style = $modal.style,
            elem = $(id);
        elem.className = "";
        game.Modal.currentContent = elem;
        $msg.appendChild(elem);
        var width = $modal.offsetWidth;
        style.marginLeft = -width / 2 + "px";
        $modal.className = "modal";
        $overlay.className = ""
    }

    function closeModal(e) {
        e && e.preventDefault();
        $modal.className = "modal hide";
        $overlay.className = "hide";
        var current = game.Modal.currentContent;
        setTimeout(function() {
            if (!current) return;
            current.className = "hide";
            document.body.appendChild(current)
        }, 600);
        return false
    }
    var event = Cevent.isTouchDevice ? "touchstart" : "click";
    Cevent.addEventListener($overlay, event, closeModal);
    Cevent.addEventListener($close, event, closeModal);
    window.game = window.game || {};
    game.Modal = {
        open: showModal,
        close: closeModal
    }
})(document, window);
(function(document, window, undefined) {
    function parseQueryString() {
        if (location.query) {
            return
        }
        var parts = location.search.replace(/^[?]/, "").split("&"),
            i = 0,
            l = parts.length,
            GET = {};
        for (; i < l; i++) {
            if (!parts[i]) {
                continue
            }
            part = parts[i].split("=");
            GET[unescape(part[0])] = unescape(part[1])
        }
        return GET
    }
    jigsaw.GET = parseQueryString()
})(document, window);

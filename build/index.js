(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _select = require('select');

var _select2 = _interopRequireDefault(_select);

/**
 * Inner class which performs selection from either `text` or `target`
 * properties and then executes copy or cut operations.
 */

var ClipboardAction = (function () {
    /**
     * @param {Object} options
     */

    function ClipboardAction(options) {
        _classCallCheck(this, ClipboardAction);

        this.resolveOptions(options);
        this.initSelection();
    }

    /**
     * Defines base properties passed from constructor.
     * @param {Object} options
     */

    ClipboardAction.prototype.resolveOptions = function resolveOptions() {
        var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

        this.action = options.action;
        this.emitter = options.emitter;
        this.target = options.target;
        this.text = options.text;
        this.trigger = options.trigger;

        this.selectedText = '';
    };

    /**
     * Decides which selection strategy is going to be applied based
     * on the existence of `text` and `target` properties.
     */

    ClipboardAction.prototype.initSelection = function initSelection() {
        if (this.text && this.target) {
            throw new Error('Multiple attributes declared, use either "target" or "text"');
        } else if (this.text) {
            this.selectFake();
        } else if (this.target) {
            this.selectTarget();
        } else {
            throw new Error('Missing required attributes, use either "target" or "text"');
        }
    };

    /**
     * Creates a fake textarea element, sets its value from `text` property,
     * and makes a selection on it.
     */

    ClipboardAction.prototype.selectFake = function selectFake() {
        var _this = this;

        this.removeFake();

        this.fakeHandler = document.body.addEventListener('click', function () {
            return _this.removeFake();
        });

        this.fakeElem = document.createElement('textarea');
        this.fakeElem.style.position = 'absolute';
        this.fakeElem.style.left = '-9999px';
        this.fakeElem.style.top = (window.pageYOffset || document.documentElement.scrollTop) + 'px';
        this.fakeElem.setAttribute('readonly', '');
        this.fakeElem.value = this.text;

        document.body.appendChild(this.fakeElem);

        this.selectedText = _select2['default'](this.fakeElem);
        this.copyText();
    };

    /**
     * Only removes the fake element after another click event, that way
     * a user can hit `Ctrl+C` to copy because selection still exists.
     */

    ClipboardAction.prototype.removeFake = function removeFake() {
        if (this.fakeHandler) {
            document.body.removeEventListener('click');
            this.fakeHandler = null;
        }

        if (this.fakeElem) {
            document.body.removeChild(this.fakeElem);
            this.fakeElem = null;
        }
    };

    /**
     * Selects the content from element passed on `target` property.
     */

    ClipboardAction.prototype.selectTarget = function selectTarget() {
        this.selectedText = _select2['default'](this.target);
        this.copyText();
    };

    /**
     * Executes the copy operation based on the current selection.
     */

    ClipboardAction.prototype.copyText = function copyText() {
        var succeeded = undefined;

        try {
            succeeded = document.execCommand(this.action);
        } catch (err) {
            succeeded = false;
        }

        this.handleResult(succeeded);
    };

    /**
     * Fires an event based on the copy operation result.
     * @param {Boolean} succeeded
     */

    ClipboardAction.prototype.handleResult = function handleResult(succeeded) {
        if (succeeded) {
            this.emitter.emit('success', {
                action: this.action,
                text: this.selectedText,
                trigger: this.trigger,
                clearSelection: this.clearSelection.bind(this)
            });
        } else {
            this.emitter.emit('error', {
                action: this.action,
                trigger: this.trigger,
                clearSelection: this.clearSelection.bind(this)
            });
        }
    };

    /**
     * Removes current selection and focus from `target` element.
     */

    ClipboardAction.prototype.clearSelection = function clearSelection() {
        if (this.target) {
            this.target.blur();
        }

        window.getSelection().removeAllRanges();
    };

    /**
     * Sets the `action` to be performed which can be either 'copy' or 'cut'.
     * @param {String} action
     */

    /**
     * Destroy lifecycle.
     */

    ClipboardAction.prototype.destroy = function destroy() {
        this.removeFake();
    };

    _createClass(ClipboardAction, [{
        key: 'action',
        set: function set() {
            var action = arguments.length <= 0 || arguments[0] === undefined ? 'copy' : arguments[0];

            this._action = action;

            if (this._action !== 'copy' && this._action !== 'cut') {
                throw new Error('Invalid "action" value, use either "copy" or "cut"');
            }
        },

        /**
         * Gets the `action` property.
         * @return {String}
         */
        get: function get() {
            return this._action;
        }

        /**
         * Sets the `target` property using an element
         * that will be have its content copied.
         * @param {Element} target
         */
    }, {
        key: 'target',
        set: function set(target) {
            if (target !== undefined) {
                if (target && typeof target === 'object' && target.nodeType === 1) {
                    this._target = target;
                } else {
                    throw new Error('Invalid "target" value, use a valid Element');
                }
            }
        },

        /**
         * Gets the `target` property.
         * @return {String|HTMLElement}
         */
        get: function get() {
            return this._target;
        }
    }]);

    return ClipboardAction;
})();

exports['default'] = ClipboardAction;
module.exports = exports['default'];
},{"select":11}],2:[function(require,module,exports){
'use strict';

exports.__esModule = true;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _clipboardAction = require('./clipboard-action');

var _clipboardAction2 = _interopRequireDefault(_clipboardAction);

var _tinyEmitter = require('tiny-emitter');

var _tinyEmitter2 = _interopRequireDefault(_tinyEmitter);

var _goodListener = require('good-listener');

var _goodListener2 = _interopRequireDefault(_goodListener);

/**
 * Base class which takes one or more elements, adds event listeners to them,
 * and instantiates a new `ClipboardAction` on each click.
 */

var Clipboard = (function (_Emitter) {
    _inherits(Clipboard, _Emitter);

    /**
     * @param {String|HTMLElement|HTMLCollection|NodeList} trigger
     * @param {Object} options
     */

    function Clipboard(trigger, options) {
        _classCallCheck(this, Clipboard);

        _Emitter.call(this);

        this.resolveOptions(options);
        this.listenClick(trigger);
    }

    /**
     * Helper function to retrieve attribute value.
     * @param {String} suffix
     * @param {Element} element
     */

    /**
     * Defines if attributes would be resolved using internal setter functions
     * or custom functions that were passed in the constructor.
     * @param {Object} options
     */

    Clipboard.prototype.resolveOptions = function resolveOptions() {
        var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

        this.action = typeof options.action === 'function' ? options.action : this.defaultAction;
        this.target = typeof options.target === 'function' ? options.target : this.defaultTarget;
        this.text = typeof options.text === 'function' ? options.text : this.defaultText;
    };

    /**
     * Adds a click event listener to the passed trigger.
     * @param {String|HTMLElement|HTMLCollection|NodeList} trigger
     */

    Clipboard.prototype.listenClick = function listenClick(trigger) {
        var _this = this;

        this.listener = _goodListener2['default'](trigger, 'click', function (e) {
            return _this.onClick(e);
        });
    };

    /**
     * Defines a new `ClipboardAction` on each click event.
     * @param {Event} e
     */

    Clipboard.prototype.onClick = function onClick(e) {
        var trigger = e.delegateTarget || e.currentTarget;

        if (this.clipboardAction) {
            this.clipboardAction = null;
        }

        this.clipboardAction = new _clipboardAction2['default']({
            action: this.action(trigger),
            target: this.target(trigger),
            text: this.text(trigger),
            trigger: trigger,
            emitter: this
        });
    };

    /**
     * Default `action` lookup function.
     * @param {Element} trigger
     */

    Clipboard.prototype.defaultAction = function defaultAction(trigger) {
        return getAttributeValue('action', trigger);
    };

    /**
     * Default `target` lookup function.
     * @param {Element} trigger
     */

    Clipboard.prototype.defaultTarget = function defaultTarget(trigger) {
        var selector = getAttributeValue('target', trigger);

        if (selector) {
            return document.querySelector(selector);
        }
    };

    /**
     * Default `text` lookup function.
     * @param {Element} trigger
     */

    Clipboard.prototype.defaultText = function defaultText(trigger) {
        return getAttributeValue('text', trigger);
    };

    /**
     * Destroy lifecycle.
     */

    Clipboard.prototype.destroy = function destroy() {
        this.listener.destroy();

        if (this.clipboardAction) {
            this.clipboardAction.destroy();
            this.clipboardAction = null;
        }
    };

    return Clipboard;
})(_tinyEmitter2['default']);

function getAttributeValue(suffix, element) {
    var attribute = 'data-clipboard-' + suffix;

    if (!element.hasAttribute(attribute)) {
        return;
    }

    return element.getAttribute(attribute);
}

exports['default'] = Clipboard;
module.exports = exports['default'];
},{"./clipboard-action":1,"good-listener":8,"tiny-emitter":12}],3:[function(require,module,exports){
var matches = require('matches-selector')

module.exports = function (element, selector, checkYoSelf) {
  var parent = checkYoSelf ? element : element.parentNode

  while (parent && parent !== document) {
    if (matches(parent, selector)) return parent;
    parent = parent.parentNode
  }
}

},{"matches-selector":9}],4:[function(require,module,exports){
var closest = require('closest');

/**
 * Delegates event to a selector.
 *
 * @param {Element} element
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @param {Boolean} useCapture
 * @return {Object}
 */
function delegate(element, selector, type, callback, useCapture) {
    var listenerFn = listener.apply(this, arguments);

    element.addEventListener(type, listenerFn, useCapture);

    return {
        destroy: function() {
            element.removeEventListener(type, listenerFn, useCapture);
        }
    }
}

/**
 * Finds closest match and invokes callback.
 *
 * @param {Element} element
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @return {Function}
 */
function listener(element, selector, type, callback) {
    return function(e) {
        e.delegateTarget = closest(e.target, selector, true);

        if (e.delegateTarget) {
            callback.call(element, e);
        }
    }
}

module.exports = delegate;

},{"closest":3}],5:[function(require,module,exports){
/*!
 * docReady v1.0.3
 * Cross browser DOMContentLoaded event emitter
 * MIT license
 */

/*jshint browser: true, strict: true, undef: true, unused: true*/
/*global define: false, require: false, module: false */

( function( window ) {

'use strict';

var document = window.document;
// collection of functions to be triggered on ready
var queue = [];

function docReady( fn ) {
  // throw out non-functions
  if ( typeof fn !== 'function' ) {
    return;
  }

  if ( docReady.isReady ) {
    // ready now, hit it
    fn();
  } else {
    // queue function when ready
    queue.push( fn );
  }
}

docReady.isReady = false;

// triggered on various doc ready events
function init( event ) {
  // bail if IE8 document is not ready just yet
  var isIE8NotReady = event.type === 'readystatechange' && document.readyState !== 'complete';
  if ( docReady.isReady || isIE8NotReady ) {
    return;
  }
  docReady.isReady = true;

  // process queue
  for ( var i=0, len = queue.length; i < len; i++ ) {
    var fn = queue[i];
    fn();
  }
}

function defineDocReady( eventie ) {
  eventie.bind( document, 'DOMContentLoaded', init );
  eventie.bind( document, 'readystatechange', init );
  eventie.bind( window, 'load', init );

  return docReady;
}

// transport
if ( typeof define === 'function' && define.amd ) {
  // AMD
  // if RequireJS, then doc is already ready
  docReady.isReady = typeof requirejs === 'function';
  define( [ 'eventie/eventie' ], defineDocReady );
} else if ( typeof exports === 'object' ) {
  module.exports = defineDocReady( require('eventie') );
} else {
  // browser global
  window.docReady = defineDocReady( window.eventie );
}

})( window );

},{"eventie":6}],6:[function(require,module,exports){
/*!
 * eventie v1.0.6
 * event binding helper
 *   eventie.bind( elem, 'click', myFn )
 *   eventie.unbind( elem, 'click', myFn )
 * MIT license
 */

/*jshint browser: true, undef: true, unused: true */
/*global define: false, module: false */

( function( window ) {

'use strict';

var docElem = document.documentElement;

var bind = function() {};

function getIEEvent( obj ) {
  var event = window.event;
  // add event.target
  event.target = event.target || event.srcElement || obj;
  return event;
}

if ( docElem.addEventListener ) {
  bind = function( obj, type, fn ) {
    obj.addEventListener( type, fn, false );
  };
} else if ( docElem.attachEvent ) {
  bind = function( obj, type, fn ) {
    obj[ type + fn ] = fn.handleEvent ?
      function() {
        var event = getIEEvent( obj );
        fn.handleEvent.call( fn, event );
      } :
      function() {
        var event = getIEEvent( obj );
        fn.call( obj, event );
      };
    obj.attachEvent( "on" + type, obj[ type + fn ] );
  };
}

var unbind = function() {};

if ( docElem.removeEventListener ) {
  unbind = function( obj, type, fn ) {
    obj.removeEventListener( type, fn, false );
  };
} else if ( docElem.detachEvent ) {
  unbind = function( obj, type, fn ) {
    obj.detachEvent( "on" + type, obj[ type + fn ] );
    try {
      delete obj[ type + fn ];
    } catch ( err ) {
      // can't delete window object properties
      obj[ type + fn ] = undefined;
    }
  };
}

var eventie = {
  bind: bind,
  unbind: unbind
};

// ----- module definition ----- //

if ( typeof define === 'function' && define.amd ) {
  // AMD
  define( eventie );
} else if ( typeof exports === 'object' ) {
  // CommonJS
  module.exports = eventie;
} else {
  // browser global
  window.eventie = eventie;
}

})( window );

},{}],7:[function(require,module,exports){
/**
 * Check if argument is a HTML element.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.node = function(value) {
    return value !== undefined
        && value instanceof HTMLElement
        && value.nodeType === 1;
};

/**
 * Check if argument is a list of HTML elements.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.nodeList = function(value) {
    var type = Object.prototype.toString.call(value);

    return value !== undefined
        && (type === '[object NodeList]' || type === '[object HTMLCollection]')
        && ('length' in value)
        && (value.length === 0 || exports.node(value[0]));
};

/**
 * Check if argument is a string.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.string = function(value) {
    return typeof value === 'string'
        || value instanceof String;
};

/**
 * Check if argument is a function.
 *
 * @param {Object} value
 * @return {Boolean}
 */
exports.fn = function(value) {
    var type = Object.prototype.toString.call(value);

    return type === '[object Function]';
};

},{}],8:[function(require,module,exports){
var is = require('./is');
var delegate = require('delegate');

/**
 * Validates all params and calls the right
 * listener function based on its target type.
 *
 * @param {String|HTMLElement|HTMLCollection|NodeList} target
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listen(target, type, callback) {
    if (!target && !type && !callback) {
        throw new Error('Missing required arguments');
    }

    if (!is.string(type)) {
        throw new TypeError('Second argument must be a String');
    }

    if (!is.fn(callback)) {
        throw new TypeError('Third argument must be a Function');
    }

    if (is.node(target)) {
        return listenNode(target, type, callback);
    }
    else if (is.nodeList(target)) {
        return listenNodeList(target, type, callback);
    }
    else if (is.string(target)) {
        return listenSelector(target, type, callback);
    }
    else {
        throw new TypeError('First argument must be a String, HTMLElement, HTMLCollection, or NodeList');
    }
}

/**
 * Adds an event listener to a HTML element
 * and returns a remove listener function.
 *
 * @param {HTMLElement} node
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenNode(node, type, callback) {
    node.addEventListener(type, callback);

    return {
        destroy: function() {
            node.removeEventListener(type, callback);
        }
    }
}

/**
 * Add an event listener to a list of HTML elements
 * and returns a remove listener function.
 *
 * @param {NodeList|HTMLCollection} nodeList
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenNodeList(nodeList, type, callback) {
    Array.prototype.forEach.call(nodeList, function(node) {
        node.addEventListener(type, callback);
    });

    return {
        destroy: function() {
            Array.prototype.forEach.call(nodeList, function(node) {
                node.removeEventListener(type, callback);
            });
        }
    }
}

/**
 * Add an event listener to a selector
 * and returns a remove listener function.
 *
 * @param {String} selector
 * @param {String} type
 * @param {Function} callback
 * @return {Object}
 */
function listenSelector(selector, type, callback) {
    return delegate(document.body, selector, type, callback);
}

module.exports = listen;

},{"./is":7,"delegate":4}],9:[function(require,module,exports){

/**
 * Element prototype.
 */

var proto = Element.prototype;

/**
 * Vendor function.
 */

var vendor = proto.matchesSelector
  || proto.webkitMatchesSelector
  || proto.mozMatchesSelector
  || proto.msMatchesSelector
  || proto.oMatchesSelector;

/**
 * Expose `match()`.
 */

module.exports = match;

/**
 * Match `el` to `selector`.
 *
 * @param {Element} el
 * @param {String} selector
 * @return {Boolean}
 * @api public
 */

function match(el, selector) {
  if (vendor) return vendor.call(el, selector);
  var nodes = el.parentNode.querySelectorAll(selector);
  for (var i = 0; i < nodes.length; ++i) {
    if (nodes[i] == el) return true;
  }
  return false;
}
},{}],10:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],11:[function(require,module,exports){
function select(element) {
    var selectedText;

    if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA') {
        element.focus();
        element.setSelectionRange(0, element.value.length);

        selectedText = element.value;
    }
    else {
        if (element.hasAttribute('contenteditable')) {
            element.focus();
        }

        var selection = window.getSelection();
        var range = document.createRange();

        range.selectNodeContents(element);
        selection.removeAllRanges();
        selection.addRange(range);

        selectedText = selection.toString();
    }

    return selectedText;
}

module.exports = select;

},{}],12:[function(require,module,exports){
function E () {
	// Keep this empty so it's easier to inherit from
  // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
}

E.prototype = {
	on: function (name, callback, ctx) {
    var e = this.e || (this.e = {});

    (e[name] || (e[name] = [])).push({
      fn: callback,
      ctx: ctx
    });

    return this;
  },

  once: function (name, callback, ctx) {
    var self = this;
    function listener () {
      self.off(name, listener);
      callback.apply(ctx, arguments);
    };

    listener._ = callback
    return this.on(name, listener, ctx);
  },

  emit: function (name) {
    var data = [].slice.call(arguments, 1);
    var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
    var i = 0;
    var len = evtArr.length;

    for (i; i < len; i++) {
      evtArr[i].fn.apply(evtArr[i].ctx, data);
    }

    return this;
  },

  off: function (name, callback) {
    var e = this.e || (this.e = {});
    var evts = e[name];
    var liveEvents = [];

    if (evts && callback) {
      for (var i = 0, len = evts.length; i < len; i++) {
        if (evts[i].fn !== callback && evts[i].fn._ !== callback)
          liveEvents.push(evts[i]);
      }
    }

    // Remove event from queue to prevent memory leak
    // Suggested by https://github.com/lazd
    // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

    (liveEvents.length)
      ? e[name] = liveEvents
      : delete e[name];

    return this;
  }
};

module.exports = E;

},{}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createComponent = require('./createComponent');

var _createComponent2 = _interopRequireDefault(_createComponent);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = (0, _createComponent2.default)();
},{"./createComponent":29}],14:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var ua = global.navigator ? global.navigator.userAgent : '';

var isTrident = exports.isTrident = ua.indexOf('Trident') > -1;
var isEdge = exports.isEdge = ua.indexOf('Edge') > -1;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],15:[function(require,module,exports){
(function (process,global){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (attrName) {
    return attrsCfg[attrName] || DEFAULT_ATTR_CFG;
};

var _escapeAttr = require('../utils/escapeAttr');

var _escapeAttr2 = _interopRequireDefault(_escapeAttr);

var _isInArray = require('../utils/isInArray');

var _isInArray2 = _interopRequireDefault(_isInArray);

var _dasherize = require('../utils/dasherize');

var _dasherize2 = _interopRequireDefault(_dasherize);

var _console = require('../utils/console');

var _console2 = _interopRequireDefault(_console);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var doc = global.document;

function setAttr(node, name, val) {
    if (name === 'type' && node.tagName === 'INPUT') {
        var value = node.value; // value will be lost in IE if type is changed
        node.setAttribute(name, '' + val);
        node.value = value;
    } else {
        node.setAttribute(ATTR_NAMES[name] || name, '' + val);
    }
}

function setBooleanAttr(node, name, val) {
    if (val) {
        setAttr(node, name, val);
    } else {
        removeAttr(node, name);
    }
}

function setProp(node, name, val) {
    node[name] = val;
}

function setObjProp(node, name, val) {
    if (process.env.NODE_ENV !== 'production') {
        var typeOfVal = typeof val === 'undefined' ? 'undefined' : _typeof(val);
        if (typeOfVal !== 'object') {
            _console2.default.error('"' + name + '" attribute expects an object as a value, not a ' + typeOfVal);
            return;
        }
    }

    var prop = node[name];
    for (var i in val) {
        prop[i] = val[i] == null ? '' : val[i];
    }
}

function setPropWithCheck(node, name, val) {
    if (name === 'value' && node.tagName === 'SELECT') {
        setSelectValue(node, val);
    } else {
        node[name] !== val && (node[name] = val);
    }
}

function removeAttr(node, name) {
    node.removeAttribute(ATTR_NAMES[name] || name);
}

function removeProp(node, name) {
    if (name === 'style') {
        node[name].cssText = '';
    } else if (name === 'value' && node.tagName === 'SELECT') {
        removeSelectValue(node);
    } else {
        node[name] = getDefaultPropVal(node.tagName, name);
    }
}

function setSelectValue(node, value) {
    var isMultiple = Array.isArray(value),
        options = node.options,
        len = options.length;

    var i = 0,
        optionNode = undefined;

    while (i < len) {
        optionNode = options[i++];
        optionNode.selected = value != null && (isMultiple ? (0, _isInArray2.default)(value, optionNode.value) : optionNode.value == value);
    }
}

function removeSelectValue(node) {
    var options = node.options,
        len = options.length;

    var i = 0;

    while (i < len) {
        options[i++].selected = false;
    }
}

function attrToString(name, value) {
    return (ATTR_NAMES[name] || name) + '="' + (0, _escapeAttr2.default)(value) + '"';
}

function booleanAttrToString(name, value) {
    return value ? name : '';
}

function stylePropToString(name, value) {
    var styles = '';

    for (var i in value) {
        value[i] != null && (styles += (0, _dasherize2.default)(i) + ':' + value[i] + ';');
    }

    return styles ? name + '="' + styles + '"' : styles;
}

var defaultPropVals = {};
function getDefaultPropVal(tag, attrName) {
    var tagAttrs = defaultPropVals[tag] || (defaultPropVals[tag] = {});
    return attrName in tagAttrs ? tagAttrs[attrName] : tagAttrs[attrName] = doc.createElement(tag)[attrName];
}

var ATTR_NAMES = {
    acceptCharset: 'accept-charset',
    className: 'class',
    htmlFor: 'for',
    httpEquiv: 'http-equiv',
    autoCapitalize: 'autocapitalize',
    autoComplete: 'autocomplete',
    autoCorrect: 'autocorrect',
    autoFocus: 'autofocus',
    autoPlay: 'autoplay',
    encType: 'encoding',
    hrefLang: 'hreflang',
    radioGroup: 'radiogroup',
    spellCheck: 'spellcheck',
    srcDoc: 'srcdoc',
    srcSet: 'srcset',
    tabIndex: 'tabindex'
},
    DEFAULT_ATTR_CFG = {
    set: setAttr,
    remove: removeAttr,
    toString: attrToString
},
    BOOLEAN_ATTR_CFG = {
    set: setBooleanAttr,
    remove: removeAttr,
    toString: booleanAttrToString
},
    DEFAULT_PROP_CFG = {
    set: setProp,
    remove: removeProp,
    toString: attrToString
},
    BOOLEAN_PROP_CFG = {
    set: setProp,
    remove: removeProp,
    toString: booleanAttrToString
},
    attrsCfg = {
    checked: BOOLEAN_PROP_CFG,
    controls: DEFAULT_PROP_CFG,
    disabled: BOOLEAN_ATTR_CFG,
    id: DEFAULT_PROP_CFG,
    ismap: BOOLEAN_ATTR_CFG,
    loop: DEFAULT_PROP_CFG,
    multiple: BOOLEAN_PROP_CFG,
    muted: DEFAULT_PROP_CFG,
    open: BOOLEAN_ATTR_CFG,
    readOnly: BOOLEAN_PROP_CFG,
    selected: BOOLEAN_PROP_CFG,
    srcDoc: DEFAULT_PROP_CFG,
    style: {
        set: setObjProp,
        remove: removeProp,
        toString: stylePropToString
    },
    value: {
        set: setPropWithCheck,
        remove: removeProp,
        toString: attrToString
    }
};
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../utils/console":35,"../utils/dasherize":36,"../utils/escapeAttr":38,"../utils/isInArray":40,"_process":10}],16:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = SyntheticEvent;
function SyntheticEvent(type, nativeEvent) {
    this.type = type;
    this.target = nativeEvent.target;
    this.nativeEvent = nativeEvent;

    this._isPropagationStopped = false;
    this._isDefaultPrevented = false;
}

SyntheticEvent.prototype = {
    stopPropagation: function stopPropagation() {
        this._isPropagationStopped = true;

        var nativeEvent = this.nativeEvent;
        nativeEvent.stopPropagation ? nativeEvent.stopPropagation() : nativeEvent.cancelBubble = true;
    },
    isPropagationStopped: function isPropagationStopped() {
        return this._isPropagationStopped;
    },
    preventDefault: function preventDefault() {
        this._isDefaultPrevented = true;

        var nativeEvent = this.nativeEvent;
        nativeEvent.preventDefault ? nativeEvent.preventDefault() : nativeEvent.returnValue = false;
    },
    isDefaultPrevented: function isDefaultPrevented() {
        return this._isDefaultPrevented;
    }
};
},{}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = {
    onMouseOver: 'mouseover',
    onMouseMove: 'mousemove',
    onMouseOut: 'mouseout',
    onMouseDown: 'mousedown',
    onMouseUp: 'mouseup',
    onClick: 'click',
    onDblClick: 'dblclick',
    onKeyDown: 'keydown',
    onKeyPress: 'keypress',
    onKeyUp: 'keyup',
    onChange: 'change',
    onInput: 'input',
    onSubmit: 'submit',
    onFocus: 'focus',
    onBlur: 'blur',
    onScroll: 'scroll',
    onLoad: 'load',
    onError: 'error',
    onContextMenu: 'contextmenu',
    onDragStart: 'dragstart',
    onDrag: 'drag',
    onDragEnter: 'dragenter',
    onDragOver: 'dragover',
    onDragLeave: 'dragleave',
    onDragEnd: 'dragend',
    onDrop: 'drop',
    onWheel: 'wheel',
    onCopy: 'copy',
    onCut: 'cut',
    onPaste: 'paste'
};
},{}],18:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.removeListeners = exports.removeListener = exports.addListener = undefined;

var _isEventSupported = require('./isEventSupported');

var _isEventSupported2 = _interopRequireDefault(_isEventSupported);

var _SyntheticEvent = require('./SyntheticEvent');

var _SyntheticEvent2 = _interopRequireDefault(_SyntheticEvent);

var _getDomNodeId = require('../getDomNodeId');

var _getDomNodeId2 = _interopRequireDefault(_getDomNodeId);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var doc = global.document,
    BUBBLEABLE_NATIVE_EVENTS = ['mouseover', 'mousemove', 'mouseout', 'mousedown', 'mouseup', 'click', 'dblclick', 'keydown', 'keypress', 'keyup', 'change', 'input', 'submit', 'focus', 'blur', 'dragstart', 'drag', 'dragenter', 'dragover', 'dragleave', 'dragend', 'drop', 'contextmenu', 'wheel', 'copy', 'cut', 'paste'],
    NON_BUBBLEABLE_NATIVE_EVENTS = ['scroll', 'load', 'error'];

var listenersStorage = {},
    eventsCfg = {};

function globalEventListener(e, type) {
    type || (type = e.type);

    var cfg = eventsCfg[type],
        listenersToInvoke = [];

    var target = e.target,
        listenersCount = cfg.listenersCounter,
        listeners = undefined,
        listener = undefined,
        domNodeId = undefined;

    while (listenersCount > 0 && target && target !== doc) {
        if (domNodeId = (0, _getDomNodeId2.default)(target, true)) {
            listeners = listenersStorage[domNodeId];
            if (listeners && (listener = listeners[type])) {
                listenersToInvoke.push(listener);
                --listenersCount;
            }
        }

        target = target.parentNode;
    }

    if (listenersToInvoke.length) {
        var event = new _SyntheticEvent2.default(type, e),
            len = listenersToInvoke.length;

        var i = 0;

        while (i < len) {
            listenersToInvoke[i++](event);
            if (event.isPropagationStopped()) {
                break;
            }
        }
    }
}

function eventListener(e) {
    listenersStorage[(0, _getDomNodeId2.default)(e.target)][e.type](new _SyntheticEvent2.default(e.type, e));
}

if (doc) {
    (function () {
        var focusEvents = {
            focus: 'focusin',
            blur: 'focusout'
        };

        var i = 0,
            type = undefined;

        while (i < BUBBLEABLE_NATIVE_EVENTS.length) {
            type = BUBBLEABLE_NATIVE_EVENTS[i++];
            eventsCfg[type] = {
                type: type,
                bubbles: true,
                listenersCounter: 0,
                set: false,
                setup: focusEvents[type] ? (0, _isEventSupported2.default)(focusEvents[type]) ? function () {
                    var type = this.type;
                    doc.addEventListener(focusEvents[type], function (e) {
                        globalEventListener(e, type);
                    });
                } : function () {
                    doc.addEventListener(this.type, globalEventListener, true);
                } : null
            };
        }

        i = 0;
        while (i < NON_BUBBLEABLE_NATIVE_EVENTS.length) {
            eventsCfg[NON_BUBBLEABLE_NATIVE_EVENTS[i++]] = {
                type: type,
                bubbles: false,
                set: false
            };
        }
    })();
}

function addListener(domNode, type, listener) {
    var cfg = eventsCfg[type];
    if (cfg) {
        if (!cfg.set) {
            cfg.setup ? cfg.setup() : cfg.bubbles && doc.addEventListener(type, globalEventListener, false);
            cfg.set = true;
        }

        var domNodeId = (0, _getDomNodeId2.default)(domNode),
            listeners = listenersStorage[domNodeId] || (listenersStorage[domNodeId] = {});

        if (!listeners[type]) {
            cfg.bubbles ? ++cfg.listenersCounter : domNode.addEventListener(type, eventListener, false);
        }

        listeners[type] = listener;
    }
}

function removeListener(domNode, type) {
    var domNodeId = (0, _getDomNodeId2.default)(domNode, true);

    if (domNodeId) {
        var listeners = listenersStorage[domNodeId];

        if (listeners && listeners[type]) {
            listeners[type] = null;

            var cfg = eventsCfg[type];

            if (cfg) {
                cfg.bubbles ? --cfg.listenersCounter : domNode.removeEventListener(type, eventListener);
            }
        }
    }
}

function removeListeners(domNode) {
    var domNodeId = (0, _getDomNodeId2.default)(domNode, true);

    if (domNodeId) {
        var listeners = listenersStorage[domNodeId];

        if (listeners) {
            delete listenersStorage[domNodeId];
            for (var type in listeners) {
                removeListener(domNode, type);
            }
        }
    }
}

exports.addListener = addListener;
exports.removeListener = removeListener;
exports.removeListeners = removeListeners;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../getDomNodeId":20,"./SyntheticEvent":16,"./isEventSupported":19}],19:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
var doc = global.document;

function isEventSupported(type) {
    var eventProp = 'on' + type;

    if (eventProp in doc) {
        return true;
    }

    var domNode = doc.createElement('div');

    domNode.setAttribute(eventProp, 'return;');
    if (typeof domNode[eventProp] === 'function') {
        return true;
    }

    return type === 'wheel' && doc.implementation && doc.implementation.hasFeature && doc.implementation.hasFeature('', '') !== true && doc.implementation.hasFeature('Events.wheel', '3.0');
}

exports.default = isEventSupported;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],20:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
var ID_PROP = '__vidom__id__';
var counter = 1;

function getDomNodeId(node, onlyGet) {
    return node[ID_PROP] || (onlyGet ? null : node[ID_PROP] = counter++);
}

exports.default = getDomNodeId;
},{}],21:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.mountToDom = mountToDom;
exports.mountToDomSync = mountToDomSync;
exports.unmountFromDom = unmountFromDom;
exports.unmountFromDomSync = unmountFromDomSync;

var _getDomNodeId = require('./getDomNodeId');

var _getDomNodeId2 = _interopRequireDefault(_getDomNodeId);

var _rafBatch = require('./rafBatch');

var _rafBatch2 = _interopRequireDefault(_rafBatch);

var _emptyObj = require('../utils/emptyObj');

var _emptyObj2 = _interopRequireDefault(_emptyObj);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var mountedNodes = {};
var counter = 0;

function mount(domNode, tree, cb, cbCtx, syncMode) {
    var domNodeId = (0, _getDomNodeId2.default)(domNode),
        mounted = mountedNodes[domNodeId],
        mountId = undefined;

    if (mounted && mounted.tree) {
        mountId = ++mounted.id;
        var patchFn = function patchFn() {
            if (mountedNodes[domNodeId] && mountedNodes[domNodeId].id === mountId) {
                mounted.tree.patch(tree);
                mounted.tree = tree;
                callCb(cb, cbCtx);
            }
        };
        syncMode ? patchFn() : (0, _rafBatch2.default)(patchFn);
    } else {
        mountedNodes[domNodeId] = { tree: null, id: mountId = ++counter };

        var existingDom = domNode.firstElementChild;
        if (existingDom) {
            mountedNodes[domNodeId].tree = tree;
            tree.adoptDom(existingDom);
            tree.mount();
            callCb(cb, cbCtx);
        } else {
            var renderFn = function renderFn() {
                if (mountedNodes[domNodeId] && mountedNodes[domNodeId].id === mountId) {
                    mountedNodes[domNodeId].tree = tree;
                    domNode.appendChild(tree.renderToDom());
                    tree.mount();
                    callCb(cb, cbCtx);
                }
            };

            syncMode ? renderFn() : (0, _rafBatch2.default)(renderFn);
        }
    }
}

function unmount(domNode, cb, cbCtx, syncMode) {
    var domNodeId = (0, _getDomNodeId2.default)(domNode);
    var mounted = mountedNodes[domNodeId];

    if (mounted) {
        (function () {
            var mountId = ++mounted.id,
                unmountFn = function unmountFn() {
                mounted = mountedNodes[domNodeId];
                if (mounted && mounted.id === mountId) {
                    delete mountedNodes[domNodeId];
                    var tree = mounted.tree;
                    if (tree) {
                        var treeDomNode = tree.getDomNode();
                        tree.unmount();
                        domNode.removeChild(treeDomNode);
                    }
                    callCb(cb, cbCtx);
                }
            };

            mounted.tree ? syncMode ? unmountFn() : (0, _rafBatch2.default)(unmountFn) : syncMode || callCb(cb, cbCtx);
        })();
    } else if (!syncMode) {
        callCb(cb, cbCtx);
    }
}

function callCb(cb, cbCtx) {
    cb && cb.call(cbCtx || this);
}

function mountToDom(domNode, tree, cb, cbCtx) {
    mount(domNode, tree, cb, cbCtx, false);
}

function mountToDomSync(domNode, tree) {
    mount(domNode, tree, null, null, true);
}

function unmountFromDom(domNode, cb, cbCtx) {
    unmount(domNode, cb, cbCtx, false);
}

function unmountFromDomSync(domNode) {
    unmount(domNode, null, null, true);
}
},{"../utils/emptyObj":37,"./getDomNodeId":20,"./rafBatch":23}],22:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _domAttrs = require('./domAttrs');

var _domAttrs2 = _interopRequireDefault(_domAttrs);

var _domEventManager = require('./events/domEventManager');

var _attrsToEvents = require('./events/attrsToEvents');

var _attrsToEvents2 = _interopRequireDefault(_attrsToEvents);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var doc = global.document;

function appendChild(parentNode, childNode) {
    parentNode.getDomNode().appendChild(childNode.renderToDom(parentNode));
    childNode.mount();
}

function insertChild(parentNode, childNode, beforeChildNode) {
    parentNode.getDomNode().insertBefore(childNode.renderToDom(parentNode), beforeChildNode.getDomNode());
    childNode.mount();
}

function removeChild(parentNode, childNode) {
    var childDomNode = childNode.getDomNode();
    childNode.unmount();
    parentNode.getDomNode().removeChild(childDomNode);
}

function moveChild(parentNode, childNode, toChildNode, after) {
    var parentDomNode = parentNode.getDomNode(),
        childDomNode = childNode.getDomNode(),
        toChildDomNode = toChildNode.getDomNode(),
        activeDomNode = doc.activeElement;

    if (after) {
        var nextSiblingDomNode = toChildDomNode.nextSibling;
        nextSiblingDomNode ? parentDomNode.insertBefore(childDomNode, nextSiblingDomNode) : parentDomNode.appendChild(childDomNode);
    } else {
        parentDomNode.insertBefore(childDomNode, toChildDomNode);
    }

    if (doc.activeElement !== activeDomNode) {
        activeDomNode.focus();
    }
}

function removeChildren(parentNode) {
    var childNodes = parentNode._children,
        len = childNodes.length;

    var j = 0;

    while (j < len) {
        childNodes[j++].unmount();
    }

    parentNode.getDomNode().innerHTML = '';
}

function replace(parentNode, oldNode, newNode) {
    var oldDomNode = oldNode.getDomNode();

    oldNode.unmount();
    oldDomNode.parentNode.replaceChild(newNode.renderToDom(parentNode), oldDomNode);
    newNode.mount();
}

function updateAttr(node, attrName, attrVal) {
    var domNode = node.getDomNode();

    _attrsToEvents2.default[attrName] ? (0, _domEventManager.addListener)(domNode, _attrsToEvents2.default[attrName], attrVal) : (0, _domAttrs2.default)(attrName).set(domNode, attrName, attrVal);
}

function removeAttr(node, attrName) {
    var domNode = node.getDomNode();

    _attrsToEvents2.default[attrName] ? (0, _domEventManager.removeListener)(domNode, _attrsToEvents2.default[attrName]) : (0, _domAttrs2.default)(attrName).remove(domNode, attrName);
}

function updateText(node, text, escape) {
    var domNode = node.getDomNode();
    escape ? domNode.textContent = text : domNode.innerHTML = text;
}

function removeText(parentNode) {
    parentNode.getDomNode().innerHTML = '';
}

exports.default = {
    appendChild: appendChild,
    insertChild: insertChild,
    removeChild: removeChild,
    moveChild: moveChild,
    removeChildren: removeChildren,
    replace: replace,
    updateAttr: updateAttr,
    removeAttr: removeAttr,
    updateText: updateText,
    removeText: removeText
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./domAttrs":15,"./events/attrsToEvents":17,"./events/domEventManager":18}],23:[function(require,module,exports){
(function (global){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
var raf = global.requestAnimationFrame || global.webkitRequestAnimationFrame || global.mozRequestAnimationFrame || function (callback) {
    setTimeout(callback, 1000 / 60);
};

var batch = [];

function applyBatch() {
    var i = 0;

    while (i < batch.length) {
        batch[i++]();
    }

    batch = [];
}

exports.default = function (fn) {
    batch.push(fn) === 1 && raf(applyBatch);
};

exports.applyBatch = applyBatch;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],24:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
var doc = global.document,
    elementProtos = {};

function createElement(ns, tag) {
    var baseElement = undefined;
    if (ns) {
        var key = ns + ':' + tag;
        baseElement = elementProtos[key] || (elementProtos[key] = doc.createElementNS(ns, tag));
    } else {
        baseElement = elementProtos[tag] || (elementProtos[tag] = doc.createElement(tag));
    }

    return baseElement.cloneNode();
}

exports.default = createElement;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],25:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
var doc = global.document,
    TOP_LEVEL_NS_TAGS = {
    'http://www.w3.org/2000/svg': 'svg',
    'http://www.w3.org/1998/Math/MathML': 'math'
};

var helperDomNode = undefined;

function createElementByHtml(html, tag, ns) {
    helperDomNode || (helperDomNode = document.createElement('div'));

    if (!ns || !TOP_LEVEL_NS_TAGS[ns] || TOP_LEVEL_NS_TAGS[ns] === tag) {
        helperDomNode.innerHTML = html;
        return helperDomNode.removeChild(helperDomNode.firstChild);
    }

    var topLevelTag = TOP_LEVEL_NS_TAGS[ns];
    helperDomNode.innerHTML = '<' + topLevelTag + ' xmlns="' + ns + '">' + html + '</' + topLevelTag + '>';
    return helperDomNode.removeChild(helperDomNode.firstChild).firstChild;
}

exports.default = createElementByHtml;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],26:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createComponent = require('../createComponent');

var _createComponent2 = _interopRequireDefault(_createComponent);

var _TagNode = require('../nodes/TagNode');

var _TagNode2 = _interopRequireDefault(_TagNode);

var _rafBatch = require('../client/rafBatch');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = (0, _createComponent2.default)({
    onInit: function onInit() {
        var _this = this;

        this.onInput = function (e) {
            var attrs = _this.getAttrs();

            attrs.onInput && attrs.onInput(e);
            attrs.onChange && attrs.onChange(e);

            (0, _rafBatch.applyBatch)();

            if (_this.isMounted()) {
                // attrs could be changed during applyBatch()
                attrs = _this.getAttrs();
                var control = _this.getDomRef('control');
                if (typeof attrs.value !== 'undefined' && control.value !== attrs.value) {
                    control.value = attrs.value;
                }
            }
        };

        this.onClick = function (e) {
            var attrs = _this.getAttrs();

            attrs.onClick && attrs.onClick(e);
            attrs.onChange && attrs.onChange(e);

            (0, _rafBatch.applyBatch)();

            if (_this.isMounted()) {
                // attrs could be changed during applyBatch()
                attrs = _this.getAttrs();
                var control = _this.getDomRef('control');
                if (typeof attrs.checked !== 'undefined' && control.checked !== attrs.checked) {
                    control.checked = attrs.checked;
                }
            }
        };
    },
    onRender: function onRender(attrs) {
        var controlAttrs = undefined;

        if (attrs.type === 'file') {
            controlAttrs = attrs;
        } else {
            controlAttrs = _extends({}, attrs, { onChange: null });

            if (attrs.type === 'checkbox' || attrs.type === 'radio') {
                controlAttrs.onClick = this.onClick;
            } else {
                controlAttrs.onInput = this.onInput;
            }
        }

        return this.setDomRef('control', new _TagNode2.default('input').attrs(controlAttrs));
    }
});
},{"../client/rafBatch":23,"../createComponent":29,"../nodes/TagNode":33}],27:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createComponent = require('../createComponent');

var _createComponent2 = _interopRequireDefault(_createComponent);

var _TagNode = require('../nodes/TagNode');

var _TagNode2 = _interopRequireDefault(_TagNode);

var _rafBatch = require('../client/rafBatch');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = (0, _createComponent2.default)({
    onInit: function onInit() {
        var _this = this;

        this.onChange = function (e) {
            var attrs = _this.getAttrs();

            attrs.onChange && attrs.onChange(e);

            (0, _rafBatch.applyBatch)();

            if (_this.isMounted()) {
                // attrs could be changed during applyBatch()
                attrs = _this.getAttrs();
                var control = _this.getDomRef('control');
                if (typeof attrs.value !== 'undefined' && control.value !== attrs.value) {
                    control.value = attrs.value;
                }
            }
        };
    },
    onRender: function onRender(attrs, children) {
        var controlAttrs = _extends({}, attrs, {
            onChange: this.onChange
        });

        return this.setDomRef('control', new _TagNode2.default('select').attrs(controlAttrs).children(children));
    }
});
},{"../client/rafBatch":23,"../createComponent":29,"../nodes/TagNode":33}],28:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createComponent = require('../createComponent');

var _createComponent2 = _interopRequireDefault(_createComponent);

var _TagNode = require('../nodes/TagNode');

var _TagNode2 = _interopRequireDefault(_TagNode);

var _rafBatch = require('../client/rafBatch');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = (0, _createComponent2.default)({
    onInit: function onInit() {
        var _this = this;

        this.onInput = function (e) {
            var attrs = _this.getAttrs();

            attrs.onInput && attrs.onInput(e);
            attrs.onChange && attrs.onChange(e);

            (0, _rafBatch.applyBatch)();

            if (_this.isMounted()) {
                // attrs could be changed during applyBatch()
                attrs = _this.getAttrs();
                var control = _this.getDomRef('control');
                if (typeof attrs.value !== 'undefined' && control.value !== attrs.value) {
                    control.value = attrs.value;
                }
            }
        };
    },
    onRender: function onRender(attrs) {
        var controlAttrs = _extends({}, attrs, {
            onInput: this.onInput,
            onChange: null
        });

        return this.setDomRef('control', new _TagNode2.default('textarea').attrs(controlAttrs));
    }
});
},{"../client/rafBatch":23,"../createComponent":29,"../nodes/TagNode":33}],29:[function(require,module,exports){
(function (process){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _noOp = require('./utils/noOp');

var _noOp2 = _interopRequireDefault(_noOp);

var _rafBatch = require('./client/rafBatch');

var _rafBatch2 = _interopRequireDefault(_rafBatch);

var _createNode = require('./createNode');

var _createNode2 = _interopRequireDefault(_createNode);

var _console = require('./utils/console');

var _console2 = _interopRequireDefault(_console);

var _emptyObj = require('./utils/emptyObj');

var _emptyObj2 = _interopRequireDefault(_emptyObj);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function mountComponent() {
    this._isMounted = true;
    this.onMount(this._attrs);
}

function unmountComponent() {
    this._isMounted = false;
    this._domRefs = null;
    this.onUnmount();
}

function patchComponent(attrs, children, ctx, parentNode) {
    attrs = this._buildAttrs(attrs);

    var prevRootNode = this._rootNode,
        prevAttrs = this._attrs;

    if (prevAttrs !== attrs) {
        this._attrs = attrs;
        if (this.isMounted()) {
            var isUpdating = this._isUpdating;
            this._isUpdating = true;
            this.onAttrsReceive(attrs, prevAttrs);
            this._isUpdating = isUpdating;
        }
    }

    this._children = children;
    this._ctx = ctx;

    if (this._isUpdating) {
        return;
    }

    var shouldUpdate = this.shouldUpdate(attrs, prevAttrs);

    if (process.env.NODE_ENV !== 'production') {
        var shouldUpdateResType = typeof shouldUpdate === 'undefined' ? 'undefined' : _typeof(shouldUpdate);
        if (shouldUpdateResType !== 'boolean') {
            _console2.default.warn('Component#shouldUpdate() should return boolean instead of ' + shouldUpdateResType);
        }
    }

    if (shouldUpdate) {
        this._rootNode = this.render();
        prevRootNode.patch(this._rootNode, parentNode);
        this.isMounted() && this.onUpdate(attrs, prevAttrs);
    }
}

function shouldComponentUpdate(attrs, prevAttrs) {
    return true;
}

function renderComponentToDom(parentNode) {
    return this._rootNode.renderToDom(parentNode);
}

function renderComponentToString() {
    return this._rootNode.renderToString();
}

function adoptComponentDom(domNode, parentNode) {
    this._rootNode.adoptDom(domNode, parentNode);
}

function getComponentDomNode() {
    return this._rootNode.getDomNode();
}

function getComponentAttrs() {
    return this._attrs;
}

function requestChildContext() {
    return _emptyObj2.default;
}

function renderComponent() {
    this._domRefs = {};

    var rootNode = this.onRender(this._attrs, this._children) || (0, _createNode2.default)('noscript');

    if (process.env.NODE_ENV !== 'production') {
        if ((typeof rootNode === 'undefined' ? 'undefined' : _typeof(rootNode)) !== 'object' || Array.isArray(rootNode)) {
            _console2.default.error('Component#onRender must return a single node object on the top level');
        }
    }

    var childCtx = this.onChildContextRequest(this._attrs);

    rootNode.ctx(childCtx === _emptyObj2.default ? this._ctx : this._ctx === _emptyObj2.default ? childCtx : _extends({}, this._ctx, childCtx));

    return rootNode;
}

function updateComponent(cb, cbCtx) {
    var _this = this;

    if (this._isUpdating) {
        cb && (0, _rafBatch2.default)(function () {
            return cb.call(cbCtx || _this);
        });
    } else {
        this._isUpdating = true;
        (0, _rafBatch2.default)(function () {
            if (_this.isMounted()) {
                _this._isUpdating = false;
                _this.patch(_this._attrs, _this._children);
                cb && cb.call(cbCtx || _this);
            }
        });
    }
}

function getComponentRootNode() {
    return this._rootNode;
}

function isComponentMounted() {
    return this._isMounted;
}

function setComponentDomRef(ref, node) {
    return this._domRefs[ref] = node;
}

function getComponentDomRef(ref) {
    return this._domRefs[ref] ? this._domRefs[ref].getDomNode() : null;
}

function getComponentContext() {
    return this._ctx;
}

function getComponentDefaultAttrs() {
    return _emptyObj2.default;
}

function buildComponentAttrs(attrs) {
    if (this._attrs && attrs === this._attrs) {
        return attrs;
    }

    var cons = this.constructor,
        defaultAttrs = cons._defaultAttrs || (cons._defaultAttrs = cons.getDefaultAttrs());

    if (!attrs) {
        return defaultAttrs;
    }

    if (defaultAttrs === _emptyObj2.default) {
        return attrs;
    }

    var res = {};

    for (var i in defaultAttrs) {
        res[i] = defaultAttrs[i];
    }

    for (var i in attrs) {
        res[i] = attrs[i];
    }

    return res;
}

function createComponent(props, staticProps) {
    var res = function res(attrs, children, ctx) {
        this._attrs = this._buildAttrs(attrs);
        this._children = children;
        this._ctx = ctx;
        this._domRefs = null;
        this._isMounted = false;
        this._isUpdating = false;
        this.onInit(this._attrs);
        this._rootNode = this.render();
    },
        ptp = {
        constructor: res,
        onInit: _noOp2.default,
        mount: mountComponent,
        unmount: unmountComponent,
        onMount: _noOp2.default,
        onUnmount: _noOp2.default,
        onAttrsReceive: _noOp2.default,
        shouldUpdate: shouldComponentUpdate,
        onUpdate: _noOp2.default,
        isMounted: isComponentMounted,
        renderToDom: renderComponentToDom,
        renderToString: renderComponentToString,
        adoptDom: adoptComponentDom,
        getDomNode: getComponentDomNode,
        getRootNode: getComponentRootNode,
        render: renderComponent,
        onRender: _noOp2.default,
        update: updateComponent,
        patch: patchComponent,
        getDomRef: getComponentDomRef,
        setDomRef: setComponentDomRef,
        getAttrs: getComponentAttrs,
        onChildContextRequest: requestChildContext,
        getContext: getComponentContext,
        _buildAttrs: buildComponentAttrs
    };

    for (var i in props) {
        ptp[i] = props[i];
    }

    res.prototype = ptp;

    res.getDefaultAttrs = getComponentDefaultAttrs;

    for (var i in staticProps) {
        res[i] = staticProps[i];
    }

    res.__vidom__component__ = true;

    return res;
}

exports.default = createComponent;
}).call(this,require('_process'))

},{"./client/rafBatch":23,"./createNode":30,"./utils/console":35,"./utils/emptyObj":37,"./utils/noOp":41,"_process":10}],30:[function(require,module,exports){
(function (process){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (type) {
    switch (typeof type === 'undefined' ? 'undefined' : _typeof(type)) {
        case 'string':
            return WRAPPER_COMPONENTS[type] ? new _ComponentNode2.default(WRAPPER_COMPONENTS[type]) : new _TagNode2.default(type);

        case 'function':
            return type.__vidom__component__ ? new _ComponentNode2.default(type) : new _FunctionComponentNode2.default(type);

        default:
            if (process.env.NODE_ENV !== 'production') {
                _console2.default.error('Unsupported type of node');
            }
    }
};

var _TagNode = require('./nodes/TagNode');

var _TagNode2 = _interopRequireDefault(_TagNode);

var _ComponentNode = require('./nodes/ComponentNode');

var _ComponentNode2 = _interopRequireDefault(_ComponentNode);

var _FunctionComponentNode = require('./nodes/FunctionComponentNode');

var _FunctionComponentNode2 = _interopRequireDefault(_FunctionComponentNode);

var _Input = require('./components/Input');

var _Input2 = _interopRequireDefault(_Input);

var _Textarea = require('./components/Textarea');

var _Textarea2 = _interopRequireDefault(_Textarea);

var _Select = require('./components/Select');

var _Select2 = _interopRequireDefault(_Select);

var _console = require('./utils/console');

var _console2 = _interopRequireDefault(_console);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var WRAPPER_COMPONENTS = {
    input: _Input2.default,
    textarea: _Textarea2.default,
    select: _Select2.default
};
}).call(this,require('_process'))

},{"./components/Input":26,"./components/Select":27,"./components/Textarea":28,"./nodes/ComponentNode":31,"./nodes/FunctionComponentNode":32,"./nodes/TagNode":33,"./utils/console":35,"_process":10}],31:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = ComponentNode;

var _emptyObj = require('../utils/emptyObj');

var _emptyObj2 = _interopRequireDefault(_emptyObj);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ComponentNode(component) {
    this.type = ComponentNode;
    this._component = component;
    this._key = null;
    this._attrs = null;
    this._instance = null;
    this._children = null;
    this._ns = null;
    this._ctx = _emptyObj2.default;
}

ComponentNode.prototype = {
    getDomNode: function getDomNode() {
        return this._instance.getDomNode();
    },
    key: function key(_key) {
        this._key = _key;
        return this;
    },
    attrs: function attrs(_attrs) {
        this._attrs = _attrs;
        return this;
    },
    children: function children(_children) {
        this._children = _children;
        return this;
    },
    ctx: function ctx(_ctx) {
        this._ctx = _ctx;
        return this;
    },
    renderToDom: function renderToDom(parentNode) {
        if (!this._ns && parentNode && parentNode._ns) {
            this._ns = parentNode._ns;
        }

        return this._getInstance().renderToDom(this);
    },
    renderToString: function renderToString() {
        return this._getInstance().renderToString();
    },
    adoptDom: function adoptDom(domNode, parentNode) {
        this._getInstance().adoptDom(domNode, parentNode);
    },
    mount: function mount() {
        this._instance.getRootNode().mount();
        this._instance.mount();
    },
    unmount: function unmount() {
        if (this._instance) {
            this._instance.getRootNode().unmount();
            this._instance.unmount();
            this._instance = null;
        }
    },
    patch: function patch(node, parentNode) {
        if (this === node) {
            return;
        }

        if (!node._ns && parentNode && parentNode._ns) {
            node._ns = parentNode._ns;
        }

        var instance = this._getInstance();

        if (this.type === node.type) {
            if (this._component === node._component) {
                instance.patch(node._attrs, node._children, node._ctx, parentNode);
                node._instance = instance;
            } else {
                instance.unmount();
                var newInstance = node._getInstance();
                instance.getRootNode().patch(newInstance.getRootNode(), parentNode);
                newInstance.mount();
            }
        } else {
            instance.unmount();
            instance.getRootNode().patch(node, parentNode);
        }
    },
    _getInstance: function _getInstance() {
        return this._instance || (this._instance = new this._component(this._attrs, this._children, this._ctx));
    }
};
},{"../utils/emptyObj":37}],32:[function(require,module,exports){
(function (process){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = FunctionComponentNode;

var _TagNode = require('./TagNode');

var _TagNode2 = _interopRequireDefault(_TagNode);

var _emptyObj = require('../utils/emptyObj');

var _emptyObj2 = _interopRequireDefault(_emptyObj);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function FunctionComponentNode(component) {
    this.type = FunctionComponentNode;
    this._component = component;
    this._key = null;
    this._attrs = _emptyObj2.default;
    this._rootNode = null;
    this._children = null;
    this._ns = null;
    this._ctx = _emptyObj2.default;
}

FunctionComponentNode.prototype = {
    getDomNode: function getDomNode() {
        return this._rootNode.getDomNode();
    },
    key: function key(_key) {
        this._key = _key;
        return this;
    },
    attrs: function attrs(_attrs) {
        this._attrs = _attrs;
        return this;
    },
    children: function children(_children) {
        this._children = _children;
        return this;
    },
    ctx: function ctx(_ctx) {
        this._ctx = _ctx;
        return this;
    },
    renderToDom: function renderToDom(parentNode) {
        if (!this._ns && parentNode && parentNode._ns) {
            this._ns = parentNode._ns;
        }

        return this._getRootNode().renderToDom(this);
    },
    renderToString: function renderToString() {
        return this._getRootNode().renderToString();
    },
    adoptDom: function adoptDom(domNode, parentNode) {
        this._getRootNode().adoptDom(domNode, parentNode);
    },
    mount: function mount() {
        this._getRootNode().mount();
    },
    unmount: function unmount() {
        if (this._rootNode) {
            this._rootNode.unmount();
            this._rootNode = null;
        }
    },
    patch: function patch(node, parentNode) {
        if (this === node) {
            return;
        }

        if (!node._ns && parentNode && parentNode._ns) {
            node._ns = parentNode._ns;
        }

        this._getRootNode().patch(this.type === node.type ? node._getRootNode() : node, parentNode);
    },
    _getRootNode: function _getRootNode() {
        if (this._rootNode) {
            return this._rootNode;
        }

        var rootNode = this._component(this._attrs, this._children, this._ctx) || new _TagNode2.default('noscript');

        if (process.env.NODE_ENV !== 'production') {
            if ((typeof rootNode === 'undefined' ? 'undefined' : _typeof(rootNode)) !== 'object' || Array.isArray(rootNode)) {
                console.error('Function component must return a single node object on the top level');
            }
        }

        rootNode.ctx(this._ctx);

        return this._rootNode = rootNode;
    }
};
}).call(this,require('_process'))

},{"../utils/emptyObj":37,"./TagNode":33,"_process":10}],33:[function(require,module,exports){
(function (process){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = TagNode;

var _patchOps = require('../client/patchOps');

var _patchOps2 = _interopRequireDefault(_patchOps);

var _domAttrs = require('../client/domAttrs');

var _domAttrs2 = _interopRequireDefault(_domAttrs);

var _domEventManager = require('../client/events/domEventManager');

var _attrsToEvents = require('../client/events/attrsToEvents');

var _attrsToEvents2 = _interopRequireDefault(_attrsToEvents);

var _escapeHtml = require('../utils/escapeHtml');

var _escapeHtml2 = _interopRequireDefault(_escapeHtml);

var _isInArray = require('../utils/isInArray');

var _isInArray2 = _interopRequireDefault(_isInArray);

var _console = require('../utils/console');

var _console2 = _interopRequireDefault(_console);

var _emptyObj = require('../utils/emptyObj');

var _emptyObj2 = _interopRequireDefault(_emptyObj);

var _browsers = require('../client/browsers');

var _createElement = require('../client/utils/createElement');

var _createElement2 = _interopRequireDefault(_createElement);

var _createElementByHtml = require('../client/utils/createElementByHtml');

var _createElementByHtml2 = _interopRequireDefault(_createElementByHtml);

var _ComponentNode = require('./ComponentNode');

var _ComponentNode2 = _interopRequireDefault(_ComponentNode);

var _FunctionComponentNode = require('./FunctionComponentNode');

var _FunctionComponentNode2 = _interopRequireDefault(_FunctionComponentNode);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var SHORT_TAGS = {
    area: true,
    base: true,
    br: true,
    col: true,
    command: true,
    embed: true,
    hr: true,
    img: true,
    input: true,
    keygen: true,
    link: true,
    menuitem: true,
    meta: true,
    param: true,
    source: true,
    track: true,
    wbr: true
},
    USE_DOM_STRINGS = _browsers.isTrident || _browsers.isEdge;

function TagNode(tag) {
    this.type = TagNode;
    this._tag = tag;
    this._domNode = null;
    this._key = null;
    this._ns = null;
    this._attrs = null;
    this._children = null;
    this._escapeChildren = true;
    this._ctx = _emptyObj2.default;
}

TagNode.prototype = {
    getDomNode: function getDomNode() {
        return this._domNode;
    },
    key: function key(_key) {
        this._key = _key;
        return this;
    },
    ns: function ns(_ns) {
        this._ns = _ns;
        return this;
    },
    attrs: function attrs(_attrs) {
        this._attrs = _attrs;

        if (process.env.NODE_ENV !== 'production') {
            checkAttrs(_attrs);
        }

        return this;
    },
    children: function children(_children) {
        if (process.env.NODE_ENV !== 'production') {
            if (this._children !== null) {
                _console2.default.warn('You\'re trying to set children or html more than once or pass both children and html.');
            }
        }

        this._children = processChildren(_children);
        return this;
    },
    ctx: function ctx(_ctx) {
        if (_ctx !== _emptyObj2.default) {
            this._ctx = _ctx;

            var children = this._children;

            if (children && typeof children !== 'string') {
                var len = children.length;
                var i = 0;

                while (i < len) {
                    children[i++].ctx(_ctx);
                }
            }
        }

        return this;
    },
    html: function html(_html) {
        if (process.env.NODE_ENV !== 'production') {
            if (this._children !== null) {
                _console2.default.warn('You\'re trying to set children or html more than once or pass both children and html.');
            }
        }

        this._children = _html;
        this._escapeChildren = false;
        return this;
    },
    renderToDom: function renderToDom(parentNode) {
        if (!this._ns && parentNode && parentNode._ns) {
            this._ns = parentNode._ns;
        }

        var children = this._children;

        if (USE_DOM_STRINGS && children && typeof children !== 'string') {
            var _domNode = (0, _createElementByHtml2.default)(this.renderToString(), this._tag, this._ns);
            this.adoptDom(_domNode, parentNode);
            return _domNode;
        }

        var domNode = (0, _createElement2.default)(this._ns, this._tag),
            attrs = this._attrs;

        if (children) {
            if (typeof children === 'string') {
                this._escapeChildren ? domNode.textContent = children : domNode.innerHTML = children;
            } else {
                var i = 0;
                var len = children.length;

                while (i < len) {
                    domNode.appendChild(children[i++].renderToDom(this));
                }
            }
        }

        if (attrs) {
            var name = undefined,
                value = undefined;
            for (name in attrs) {
                (value = attrs[name]) != null && (_attrsToEvents2.default[name] ? (0, _domEventManager.addListener)(domNode, _attrsToEvents2.default[name], value) : (0, _domAttrs2.default)(name).set(domNode, name, value));
            }
        }

        return this._domNode = domNode;
    },
    renderToString: function renderToString() {
        var tag = this._tag,
            ns = this._ns,
            attrs = this._attrs;

        var children = this._children,
            res = '<' + tag;

        if (ns) {
            res += ' xmlns="' + ns + '"';
        }

        if (attrs) {
            var name = undefined,
                value = undefined,
                attrHtml = undefined;
            for (name in attrs) {
                value = attrs[name];

                if (value != null) {
                    if (name === 'value') {
                        switch (tag) {
                            case 'textarea':
                                children = value;
                                continue;

                            case 'select':
                                this.ctx({ value: value, multiple: attrs.multiple });
                                continue;

                            case 'option':
                                if (this._ctx.multiple ? (0, _isInArray2.default)(this._ctx.value, value) : this._ctx.value === value) {
                                    res += ' ' + (0, _domAttrs2.default)('selected').toString('selected', true);
                                }
                        }
                    }

                    if (!_attrsToEvents2.default[name] && (attrHtml = (0, _domAttrs2.default)(name).toString(name, value))) {
                        res += ' ' + attrHtml;
                    }
                }
            }
        }

        if (SHORT_TAGS[tag]) {
            res += '/>';
        } else {
            res += '>';

            if (children) {
                if (typeof children === 'string') {
                    res += this._escapeChildren ? (0, _escapeHtml2.default)(children) : children;
                } else {
                    var i = 0;
                    var len = children.length;

                    while (i < len) {
                        res += children[i++].renderToString();
                    }
                }
            }

            res += '</' + tag + '>';
        }

        return res;
    },
    adoptDom: function adoptDom(domNode, parentNode) {
        if (!this._ns && parentNode && parentNode._ns) {
            this._ns = parentNode._ns;
        }

        this._domNode = domNode;

        var attrs = this._attrs,
            children = this._children;

        if (attrs) {
            var name = undefined,
                value = undefined;
            for (name in attrs) {
                if ((value = attrs[name]) != null && _attrsToEvents2.default[name]) {
                    (0, _domEventManager.addListener)(domNode, _attrsToEvents2.default[name], value);
                }
            }
        }

        if (children && typeof children !== 'string') {
            var i = 0;
            var len = children.length;

            if (len) {
                var domChildren = domNode.childNodes;
                while (i < len) {
                    children[i].adoptDom(domChildren[i], this);
                    ++i;
                }
            }
        }
    },
    mount: function mount() {
        var children = this._children;

        if (children && typeof children !== 'string') {
            var i = 0;
            var len = children.length;

            while (i < len) {
                children[i++].mount();
            }
        }
    },
    unmount: function unmount() {
        var children = this._children;

        if (children && typeof children !== 'string') {
            var i = 0;
            var len = children.length;

            while (i < len) {
                children[i++].unmount();
            }
        }

        (0, _domEventManager.removeListeners)(this._domNode);

        this._domNode = null;
    },
    patch: function patch(node, parentNode) {
        if (this === node) {
            return;
        }

        if (!node._ns && parentNode && parentNode._ns) {
            node._ns = parentNode._ns;
        }

        if (this.type !== node.type) {
            switch (node.type) {
                case _ComponentNode2.default:
                    var instance = node._getInstance();
                    this.patch(instance.getRootNode(), parentNode);
                    instance.mount();
                    break;

                case _FunctionComponentNode2.default:
                    this.patch(node._getRootNode(), parentNode);
                    break;

                default:
                    _patchOps2.default.replace(parentNode || null, this, node);
            }
            return;
        }

        if (this._tag !== node._tag || this._ns !== node._ns) {
            _patchOps2.default.replace(parentNode || null, this, node);
            return;
        }

        this._domNode && (node._domNode = this._domNode);

        this._patchChildren(node);
        this._patchAttrs(node);
    },
    _patchChildren: function _patchChildren(node) {
        var childrenA = this._children,
            childrenB = node._children;

        if (childrenA === childrenB) {
            return;
        }

        var isChildrenAText = typeof childrenA === 'string',
            isChildrenBText = typeof childrenB === 'string';

        if (isChildrenBText) {
            if (isChildrenAText) {
                _patchOps2.default.updateText(this, childrenB, node._escapeChildren);
                return;
            }

            childrenA && childrenA.length && _patchOps2.default.removeChildren(this);
            childrenB && _patchOps2.default.updateText(this, childrenB, node._escapeChildren);

            return;
        }

        if (!childrenB || !childrenB.length) {
            if (childrenA) {
                isChildrenAText ? _patchOps2.default.removeText(this) : childrenA.length && _patchOps2.default.removeChildren(this);
            }

            return;
        }

        if (isChildrenAText && childrenA) {
            _patchOps2.default.removeText(this);
        }

        var childrenBLen = childrenB.length;

        if (isChildrenAText || !childrenA || !childrenA.length) {
            var iB = 0;
            while (iB < childrenBLen) {
                _patchOps2.default.appendChild(node, childrenB[iB++]);
            }
            return;
        }

        var childrenALen = childrenA.length;

        if (childrenALen === 1 && childrenBLen === 1) {
            childrenA[0].patch(childrenB[0], node);
            return;
        }

        var leftIdxA = 0,
            rightIdxA = childrenALen - 1,
            leftChildA = childrenA[leftIdxA],
            leftChildAKey = leftChildA._key,
            rightChildA = childrenA[rightIdxA],
            rightChildAKey = rightChildA._key,
            leftIdxB = 0,
            rightIdxB = childrenBLen - 1,
            leftChildB = childrenB[leftIdxB],
            leftChildBKey = leftChildB._key,
            rightChildB = childrenB[rightIdxB],
            rightChildBKey = rightChildB._key,
            updateLeftIdxA = false,
            updateRightIdxA = false,
            updateLeftIdxB = false,
            updateRightIdxB = false,
            childrenAIndicesToSkip = {},
            childrenAKeys = undefined,
            foundAChildIdx = undefined,
            foundAChild = undefined;

        while (leftIdxA <= rightIdxA && leftIdxB <= rightIdxB) {
            if (childrenAIndicesToSkip[leftIdxA]) {
                updateLeftIdxA = true;
            } else if (childrenAIndicesToSkip[rightIdxA]) {
                updateRightIdxA = true;
            } else if (leftChildAKey === leftChildBKey) {
                leftChildA.patch(leftChildB, node);
                updateLeftIdxA = true;
                updateLeftIdxB = true;
            } else if (rightChildAKey === rightChildBKey) {
                rightChildA.patch(rightChildB, node);
                updateRightIdxA = true;
                updateRightIdxB = true;
            } else if (leftChildAKey != null && leftChildAKey === rightChildBKey) {
                _patchOps2.default.moveChild(node, leftChildA, rightChildA, true);
                leftChildA.patch(rightChildB, node);
                updateLeftIdxA = true;
                updateRightIdxB = true;
            } else if (rightChildAKey != null && rightChildAKey === leftChildBKey) {
                _patchOps2.default.moveChild(node, rightChildA, leftChildA, false);
                rightChildA.patch(leftChildB, node);
                updateRightIdxA = true;
                updateLeftIdxB = true;
            } else if (leftChildAKey != null && leftChildBKey == null) {
                _patchOps2.default.insertChild(node, leftChildB, leftChildA);
                updateLeftIdxB = true;
            } else if (leftChildAKey == null && leftChildBKey != null) {
                _patchOps2.default.removeChild(node, leftChildA);
                updateLeftIdxA = true;
            } else {
                childrenAKeys || (childrenAKeys = buildKeys(childrenA, leftIdxA, rightIdxA));
                if ((foundAChildIdx = childrenAKeys[leftChildBKey]) != null) {
                    foundAChild = childrenA[foundAChildIdx];
                    childrenAIndicesToSkip[foundAChildIdx] = true;
                    _patchOps2.default.moveChild(node, foundAChild, leftChildA, false);
                    foundAChild.patch(leftChildB, node);
                } else {
                    _patchOps2.default.insertChild(node, leftChildB, leftChildA);
                }
                updateLeftIdxB = true;
            }

            if (updateLeftIdxA) {
                updateLeftIdxA = false;
                if (++leftIdxA <= rightIdxA) {
                    leftChildA = childrenA[leftIdxA];
                    leftChildAKey = leftChildA._key;
                }
            }

            if (updateRightIdxA) {
                updateRightIdxA = false;
                if (--rightIdxA >= leftIdxA) {
                    rightChildA = childrenA[rightIdxA];
                    rightChildAKey = rightChildA._key;
                }
            }

            if (updateLeftIdxB) {
                updateLeftIdxB = false;
                if (++leftIdxB <= rightIdxB) {
                    leftChildB = childrenB[leftIdxB];
                    leftChildBKey = leftChildB._key;
                }
            }

            if (updateRightIdxB) {
                updateRightIdxB = false;
                if (--rightIdxB >= leftIdxB) {
                    rightChildB = childrenB[rightIdxB];
                    rightChildBKey = rightChildB._key;
                }
            }
        }

        while (leftIdxA <= rightIdxA) {
            if (!childrenAIndicesToSkip[leftIdxA]) {
                _patchOps2.default.removeChild(node, childrenA[leftIdxA]);
            }
            ++leftIdxA;
        }

        while (leftIdxB <= rightIdxB) {
            rightIdxB < childrenBLen - 1 ? _patchOps2.default.insertChild(node, childrenB[leftIdxB], childrenB[rightIdxB + 1]) : _patchOps2.default.appendChild(node, childrenB[leftIdxB]);
            ++leftIdxB;
        }
    },
    _patchAttrs: function _patchAttrs(node) {
        var attrsA = this._attrs,
            attrsB = node._attrs;

        if (attrsA === attrsB) {
            return;
        }

        var attrName = undefined,
            attrAVal = undefined,
            attrBVal = undefined,
            isAttrAValArray = undefined,
            isAttrBValArray = undefined;

        if (attrsB) {
            for (attrName in attrsB) {
                attrBVal = attrsB[attrName];
                if (!attrsA || (attrAVal = attrsA[attrName]) == null) {
                    if (attrBVal != null) {
                        _patchOps2.default.updateAttr(this, attrName, attrBVal);
                    }
                } else if (attrBVal == null) {
                    _patchOps2.default.removeAttr(this, attrName);
                } else if ((typeof attrBVal === 'undefined' ? 'undefined' : _typeof(attrBVal)) === 'object' && (typeof attrAVal === 'undefined' ? 'undefined' : _typeof(attrAVal)) === 'object') {
                    isAttrBValArray = Array.isArray(attrBVal);
                    isAttrAValArray = Array.isArray(attrAVal);
                    if (isAttrBValArray || isAttrAValArray) {
                        if (isAttrBValArray && isAttrAValArray) {
                            this._patchAttrArr(attrName, attrAVal, attrBVal);
                        } else {
                            _patchOps2.default.updateAttr(this, attrName, attrBVal);
                        }
                    } else {
                        this._patchAttrObj(attrName, attrAVal, attrBVal);
                    }
                } else if (attrAVal !== attrBVal) {
                    _patchOps2.default.updateAttr(this, attrName, attrBVal);
                }
            }
        }

        if (attrsA) {
            for (attrName in attrsA) {
                if ((!attrsB || !(attrName in attrsB)) && (attrAVal = attrsA[attrName]) != null) {
                    _patchOps2.default.removeAttr(this, attrName);
                }
            }
        }
    },
    _patchAttrArr: function _patchAttrArr(attrName, arrA, arrB) {
        if (arrA === arrB) {
            return;
        }

        var lenA = arrA.length;
        var hasDiff = false;

        if (lenA !== arrB.length) {
            hasDiff = true;
        } else {
            var i = 0;
            while (!hasDiff && i < lenA) {
                if (arrA[i] != arrB[i]) {
                    hasDiff = true;
                }
                ++i;
            }
        }

        hasDiff && _patchOps2.default.updateAttr(this, attrName, arrB);
    },
    _patchAttrObj: function _patchAttrObj(attrName, objA, objB) {
        if (objA === objB) {
            return;
        }

        var hasDiff = false,
            diffObj = {};

        for (var i in objB) {
            if (objA[i] != objB[i]) {
                hasDiff = true;
                diffObj[i] = objB[i];
            }
        }

        for (var i in objA) {
            if (objA[i] != null && !(i in objB)) {
                hasDiff = true;
                diffObj[i] = null;
            }
        }

        hasDiff && _patchOps2.default.updateAttr(this, attrName, diffObj);
    }
};

function processChildren(children) {
    if (children == null) {
        return null;
    }

    var typeOfChildren = typeof children === 'undefined' ? 'undefined' : _typeof(children);

    if (typeOfChildren === 'object') {
        var res = Array.isArray(children) ? children : [children];

        if (process.env.NODE_ENV !== 'production') {
            checkChildren(res);
        }

        return res;
    }

    return typeOfChildren === 'string' ? children : children.toString();
}

function checkChildren(children) {
    var keys = {},
        len = children.length;

    var i = 0,
        child = undefined;

    while (i < len) {
        child = children[i++];

        if ((typeof child === 'undefined' ? 'undefined' : _typeof(child)) !== 'object') {
            _console2.default.error('You mustn\'t use simple child in case of multiple children.');
        } else if (child._key != null) {
            if (child._key in keys) {
                _console2.default.error('Childrens\' keys must be unique across the children. Found duplicate of "' + child._key + '" key.');
            } else {
                keys[child._key] = true;
            }
        }
    }
}

function buildKeys(children, idxFrom, idxTo) {
    var res = {},
        child = undefined;

    while (idxFrom < idxTo) {
        child = children[idxFrom];
        child._key != null && (res[child._key] = idxFrom);
        ++idxFrom;
    }

    return res;
}

function checkAttrs(attrs) {
    for (var name in attrs) {
        if (name.substr(0, 2) === 'on' && !_attrsToEvents2.default[name]) {
            _console2.default.error('You\'re trying to add unsupported event listener "' + name + '".');
        }
    }
}
}).call(this,require('_process'))

},{"../client/browsers":14,"../client/domAttrs":15,"../client/events/attrsToEvents":17,"../client/events/domEventManager":18,"../client/patchOps":22,"../client/utils/createElement":24,"../client/utils/createElementByHtml":25,"../utils/console":35,"../utils/emptyObj":37,"../utils/escapeHtml":39,"../utils/isInArray":40,"./ComponentNode":31,"./FunctionComponentNode":32,"_process":10}],34:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (tree) {
  return tree.renderToString();
};
},{}],35:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _noOp = require('./noOp');

var _noOp2 = _interopRequireDefault(_noOp);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var globalConsole = global.console,
    console = {},
    PREFIXES = {
    log: '',
    info: '',
    warn: 'Warning!',
    error: 'Error!'
};

['log', 'info', 'warn', 'error'].forEach(function (name) {
    console[name] = globalConsole ? globalConsole[name] ? function (arg1, arg2, arg3, arg4, arg5) {
        // IE9: console methods aren't functions
        var arg0 = PREFIXES[name];
        switch (arguments.length) {
            case 1:
                globalConsole[name](arg0, arg1);
                break;

            case 2:
                globalConsole[name](arg0, arg1, arg2);
                break;

            case 3:
                globalConsole[name](arg0, arg1, arg2, arg3);
                break;

            case 4:
                globalConsole[name](arg0, arg1, arg2, arg3, arg4);
                break;

            case 5:
                globalConsole[name](arg0, arg1, arg2, arg3, arg4, arg5);
                break;
        }
    } : function () {
        globalConsole.log.apply(globalConsole, arguments);
    } : _noOp2.default;
});

exports.default = console;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./noOp":41}],36:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var DASHERIZE_RE = /([^A-Z]+)([A-Z])/g;

exports.default = function (str) {
  return str.replace(DASHERIZE_RE, '$1-$2').toLowerCase();
};
},{}],37:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = {};
},{}],38:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (str) {
    return (str + '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
};
},{}],39:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (str) {
    return (str + '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};
},{}],40:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (arr, item) {
    var len = arr.length;
    var i = 0;

    while (i < len) {
        if (arr[i++] == item) {
            return true;
        }
    }

    return false;
};
},{}],41:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function () {};
},{}],42:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (children) {
    var res = normalizeChildren(children);

    if (res !== null && (typeof res === 'undefined' ? 'undefined' : _typeof(res)) === 'object' && !Array.isArray(res)) {
        res = [res];
    }

    return res;
};

var _createNode = require('../createNode');

var _createNode2 = _interopRequireDefault(_createNode);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function normalizeChildren(children) {
    if (children == null) {
        return null;
    }

    var typeOfChildren = typeof children === 'undefined' ? 'undefined' : _typeof(children);
    if (typeOfChildren !== 'object') {
        return typeOfChildren === 'string' ? children : children.toString();
    }

    if (!Array.isArray(children)) {
        return children;
    }

    if (!children.length) {
        return null;
    }

    var res = children,
        i = 0,
        len = children.length,
        allSkipped = true,
        child = undefined,
        isChildObject = undefined;

    while (i < len) {
        child = normalizeChildren(children[i]);
        if (child === null) {
            if (res !== null) {
                if (allSkipped) {
                    res = null;
                } else if (res === children) {
                    res = children.slice(0, i);
                }
            }
        } else {
            if (res === null) {
                res = child;
            } else if (Array.isArray(child)) {
                res = allSkipped ? child : (res === children ? res.slice(0, i) : Array.isArray(res) ? res : [res]).concat(child);
            } else {
                isChildObject = (typeof child === 'undefined' ? 'undefined' : _typeof(child)) === 'object';

                if (isChildObject && children[i] === child) {
                    if (res !== children) {
                        res = join(res, child);
                    }
                } else {
                    if (res === children) {
                        if (allSkipped && isChildObject) {
                            res = child;
                            ++i;
                            continue;
                        }

                        res = res.slice(0, i);
                    }

                    res = join(res, child);
                }
            }

            allSkipped = false;
        }

        ++i;
    }

    return res;
}

function toNode(obj) {
    return (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) === 'object' ? obj : (0, _createNode2.default)('span').children(obj);
}

function join(objA, objB) {
    if (Array.isArray(objA)) {
        objA.push(toNode(objB));
        return objA;
    }

    return [toNode(objA), toNode(objB)];
}
},{"../createNode":30}],43:[function(require,module,exports){
(function (process){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.Component = exports.normalizeChildren = exports.renderToString = exports.createComponent = exports.node = exports.unmountFromDomSync = exports.unmountFromDom = exports.mountToDomSync = exports.mountToDom = undefined;

var _mounter = require('./client/mounter');

Object.defineProperty(exports, 'mountToDom', {
    enumerable: true,
    get: function get() {
        return _mounter.mountToDom;
    }
});
Object.defineProperty(exports, 'mountToDomSync', {
    enumerable: true,
    get: function get() {
        return _mounter.mountToDomSync;
    }
});
Object.defineProperty(exports, 'unmountFromDom', {
    enumerable: true,
    get: function get() {
        return _mounter.unmountFromDom;
    }
});
Object.defineProperty(exports, 'unmountFromDomSync', {
    enumerable: true,
    get: function get() {
        return _mounter.unmountFromDomSync;
    }
});

var _createNode = require('./createNode');

var _createNode2 = _interopRequireDefault(_createNode);

var _createComponent = require('./createComponent');

var _createComponent2 = _interopRequireDefault(_createComponent);

var _renderToString = require('./renderToString');

var _renderToString2 = _interopRequireDefault(_renderToString);

var _normalizeChildren = require('./utils/normalizeChildren');

var _normalizeChildren2 = _interopRequireDefault(_normalizeChildren);

var _Component = require('./Component');

var _Component2 = _interopRequireDefault(_Component);

var _console = require('./utils/console');

var _console2 = _interopRequireDefault(_console);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

if (process.env.NODE_ENV !== 'production') {
    _console2.default.info('You\'re using dev version of Vidom');
}

// TODO: take back after https://phabricator.babeljs.io/T6786
// export * from './client/mounter';
exports.node = _createNode2.default;
exports.createComponent = _createComponent2.default;
exports.renderToString = _renderToString2.default;
exports.normalizeChildren = _normalizeChildren2.default;
exports.Component = _Component2.default;
}).call(this,require('_process'))

},{"./Component":13,"./client/mounter":21,"./createComponent":29,"./createNode":30,"./renderToString":34,"./utils/console":35,"./utils/normalizeChildren":42,"_process":10}],44:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _clipboard = require("clipboard");

var _clipboard2 = _interopRequireDefault(_clipboard);

var _vidom = require("vidom/lib/vidom");

var _docReady = require("doc-ready");

var _docReady2 = _interopRequireDefault(_docReady);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var App = function (_Component) {
  _inherits(App, _Component);

  function App() {
    _classCallCheck(this, App);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(App).apply(this, arguments));
  }

  _createClass(App, [{
    key: "onRender",
    value: function onRender() {
      return (0, _vidom.node)("div").children("hello");
    }
  }]);

  return App;
}(_vidom.Component);

(0, _docReady2.default)(function () {
  var container = document.getElementById('container');
  (0, _vidom.mountToDom)(container, (0, _vidom.node)(App));
});

},{"clipboard":2,"doc-ready":5,"vidom/lib/vidom":43}]},{},[44])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvY2xpcGJvYXJkL2xpYi9jbGlwYm9hcmQtYWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2NsaXBib2FyZC9saWIvY2xpcGJvYXJkLmpzIiwibm9kZV9tb2R1bGVzL2Nsb3Nlc3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZGVsZWdhdGUvc3JjL2RlbGVnYXRlLmpzIiwibm9kZV9tb2R1bGVzL2RvYy1yZWFkeS9kb2MtcmVhZHkuanMiLCJub2RlX21vZHVsZXMvZXZlbnRpZS9ldmVudGllLmpzIiwibm9kZV9tb2R1bGVzL2dvb2QtbGlzdGVuZXIvc3JjL2lzLmpzIiwibm9kZV9tb2R1bGVzL2dvb2QtbGlzdGVuZXIvc3JjL2xpc3Rlbi5qcyIsIm5vZGVfbW9kdWxlcy9tYXRjaGVzLXNlbGVjdG9yL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy9zZWxlY3Qvc3JjL3NlbGVjdC5qcyIsIm5vZGVfbW9kdWxlcy90aW55LWVtaXR0ZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL0NvbXBvbmVudC5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvY2xpZW50L2Jyb3dzZXJzLmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi9jbGllbnQvZG9tQXR0cnMuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL2NsaWVudC9ldmVudHMvU3ludGhldGljRXZlbnQuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL2NsaWVudC9ldmVudHMvYXR0cnNUb0V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvY2xpZW50L2V2ZW50cy9kb21FdmVudE1hbmFnZXIuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL2NsaWVudC9ldmVudHMvaXNFdmVudFN1cHBvcnRlZC5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvY2xpZW50L2dldERvbU5vZGVJZC5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvY2xpZW50L21vdW50ZXIuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL2NsaWVudC9wYXRjaE9wcy5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvY2xpZW50L3JhZkJhdGNoLmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi9jbGllbnQvdXRpbHMvY3JlYXRlRWxlbWVudC5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvY2xpZW50L3V0aWxzL2NyZWF0ZUVsZW1lbnRCeUh0bWwuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL2NvbXBvbmVudHMvSW5wdXQuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL2NvbXBvbmVudHMvU2VsZWN0LmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi9jb21wb25lbnRzL1RleHRhcmVhLmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi9jcmVhdGVDb21wb25lbnQuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL2NyZWF0ZU5vZGUuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL25vZGVzL0NvbXBvbmVudE5vZGUuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL25vZGVzL0Z1bmN0aW9uQ29tcG9uZW50Tm9kZS5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvbm9kZXMvVGFnTm9kZS5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvcmVuZGVyVG9TdHJpbmcuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL3V0aWxzL2NvbnNvbGUuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL3V0aWxzL2Rhc2hlcml6ZS5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvdXRpbHMvZW1wdHlPYmouanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL3V0aWxzL2VzY2FwZUF0dHIuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL3V0aWxzL2VzY2FwZUh0bWwuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL3V0aWxzL2lzSW5BcnJheS5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvdXRpbHMvbm9PcC5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvdXRpbHMvbm9ybWFsaXplQ2hpbGRyZW4uanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL3ZpZG9tLmpzIiwic3JjL2luZGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdk9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDek1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3BLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNoSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQzNHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ2hRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNqR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNwR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbHFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbkRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDMUdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lDbEVNOzs7Ozs7Ozs7OzsrQkFDTTtBQUNSLGFBQU8saUJBQUssS0FBTCxFQUFZLFFBQVosQ0FBcUIsT0FBckIsQ0FBUCxDQURROzs7O1NBRE47OztBQU1OLHdCQUFVLFlBQVU7QUFDbEIsTUFBSSxZQUFZLFNBQVMsY0FBVCxDQUF3QixXQUF4QixDQUFaLENBRGM7QUFFbEIseUJBQVcsU0FBWCxFQUFzQixpQkFBSyxHQUFMLENBQXRCLEVBRmtCO0NBQVYsQ0FBViIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7XG5cbnZhciBfY3JlYXRlQ2xhc3MgPSAoZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBkZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykgeyB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldOyBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7IGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTsgaWYgKCd2YWx1ZScgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTsgfSB9IHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7IGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH07IH0pKCk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7ICdkZWZhdWx0Jzogb2JqIH07IH1cblxuZnVuY3Rpb24gX2NsYXNzQ2FsbENoZWNrKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9XG5cbnZhciBfc2VsZWN0ID0gcmVxdWlyZSgnc2VsZWN0Jyk7XG5cbnZhciBfc2VsZWN0MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3NlbGVjdCk7XG5cbi8qKlxuICogSW5uZXIgY2xhc3Mgd2hpY2ggcGVyZm9ybXMgc2VsZWN0aW9uIGZyb20gZWl0aGVyIGB0ZXh0YCBvciBgdGFyZ2V0YFxuICogcHJvcGVydGllcyBhbmQgdGhlbiBleGVjdXRlcyBjb3B5IG9yIGN1dCBvcGVyYXRpb25zLlxuICovXG5cbnZhciBDbGlwYm9hcmRBY3Rpb24gPSAoZnVuY3Rpb24gKCkge1xuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICovXG5cbiAgICBmdW5jdGlvbiBDbGlwYm9hcmRBY3Rpb24ob3B0aW9ucykge1xuICAgICAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgQ2xpcGJvYXJkQWN0aW9uKTtcblxuICAgICAgICB0aGlzLnJlc29sdmVPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICB0aGlzLmluaXRTZWxlY3Rpb24oKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEZWZpbmVzIGJhc2UgcHJvcGVydGllcyBwYXNzZWQgZnJvbSBjb25zdHJ1Y3Rvci5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgICAqL1xuXG4gICAgQ2xpcGJvYXJkQWN0aW9uLnByb3RvdHlwZS5yZXNvbHZlT3B0aW9ucyA9IGZ1bmN0aW9uIHJlc29sdmVPcHRpb25zKCkge1xuICAgICAgICB2YXIgb3B0aW9ucyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzBdO1xuXG4gICAgICAgIHRoaXMuYWN0aW9uID0gb3B0aW9ucy5hY3Rpb247XG4gICAgICAgIHRoaXMuZW1pdHRlciA9IG9wdGlvbnMuZW1pdHRlcjtcbiAgICAgICAgdGhpcy50YXJnZXQgPSBvcHRpb25zLnRhcmdldDtcbiAgICAgICAgdGhpcy50ZXh0ID0gb3B0aW9ucy50ZXh0O1xuICAgICAgICB0aGlzLnRyaWdnZXIgPSBvcHRpb25zLnRyaWdnZXI7XG5cbiAgICAgICAgdGhpcy5zZWxlY3RlZFRleHQgPSAnJztcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRGVjaWRlcyB3aGljaCBzZWxlY3Rpb24gc3RyYXRlZ3kgaXMgZ29pbmcgdG8gYmUgYXBwbGllZCBiYXNlZFxuICAgICAqIG9uIHRoZSBleGlzdGVuY2Ugb2YgYHRleHRgIGFuZCBgdGFyZ2V0YCBwcm9wZXJ0aWVzLlxuICAgICAqL1xuXG4gICAgQ2xpcGJvYXJkQWN0aW9uLnByb3RvdHlwZS5pbml0U2VsZWN0aW9uID0gZnVuY3Rpb24gaW5pdFNlbGVjdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMudGV4dCAmJiB0aGlzLnRhcmdldCkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNdWx0aXBsZSBhdHRyaWJ1dGVzIGRlY2xhcmVkLCB1c2UgZWl0aGVyIFwidGFyZ2V0XCIgb3IgXCJ0ZXh0XCInKTtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLnRleHQpIHtcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0RmFrZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMudGFyZ2V0KSB7XG4gICAgICAgICAgICB0aGlzLnNlbGVjdFRhcmdldCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIHJlcXVpcmVkIGF0dHJpYnV0ZXMsIHVzZSBlaXRoZXIgXCJ0YXJnZXRcIiBvciBcInRleHRcIicpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIENyZWF0ZXMgYSBmYWtlIHRleHRhcmVhIGVsZW1lbnQsIHNldHMgaXRzIHZhbHVlIGZyb20gYHRleHRgIHByb3BlcnR5LFxuICAgICAqIGFuZCBtYWtlcyBhIHNlbGVjdGlvbiBvbiBpdC5cbiAgICAgKi9cblxuICAgIENsaXBib2FyZEFjdGlvbi5wcm90b3R5cGUuc2VsZWN0RmFrZSA9IGZ1bmN0aW9uIHNlbGVjdEZha2UoKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5yZW1vdmVGYWtlKCk7XG5cbiAgICAgICAgdGhpcy5mYWtlSGFuZGxlciA9IGRvY3VtZW50LmJvZHkuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMucmVtb3ZlRmFrZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICB0aGlzLmZha2VFbGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndGV4dGFyZWEnKTtcbiAgICAgICAgdGhpcy5mYWtlRWxlbS5zdHlsZS5wb3NpdGlvbiA9ICdhYnNvbHV0ZSc7XG4gICAgICAgIHRoaXMuZmFrZUVsZW0uc3R5bGUubGVmdCA9ICctOTk5OXB4JztcbiAgICAgICAgdGhpcy5mYWtlRWxlbS5zdHlsZS50b3AgPSAod2luZG93LnBhZ2VZT2Zmc2V0IHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3ApICsgJ3B4JztcbiAgICAgICAgdGhpcy5mYWtlRWxlbS5zZXRBdHRyaWJ1dGUoJ3JlYWRvbmx5JywgJycpO1xuICAgICAgICB0aGlzLmZha2VFbGVtLnZhbHVlID0gdGhpcy50ZXh0O1xuXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGhpcy5mYWtlRWxlbSk7XG5cbiAgICAgICAgdGhpcy5zZWxlY3RlZFRleHQgPSBfc2VsZWN0MlsnZGVmYXVsdCddKHRoaXMuZmFrZUVsZW0pO1xuICAgICAgICB0aGlzLmNvcHlUZXh0KCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIE9ubHkgcmVtb3ZlcyB0aGUgZmFrZSBlbGVtZW50IGFmdGVyIGFub3RoZXIgY2xpY2sgZXZlbnQsIHRoYXQgd2F5XG4gICAgICogYSB1c2VyIGNhbiBoaXQgYEN0cmwrQ2AgdG8gY29weSBiZWNhdXNlIHNlbGVjdGlvbiBzdGlsbCBleGlzdHMuXG4gICAgICovXG5cbiAgICBDbGlwYm9hcmRBY3Rpb24ucHJvdG90eXBlLnJlbW92ZUZha2UgPSBmdW5jdGlvbiByZW1vdmVGYWtlKCkge1xuICAgICAgICBpZiAodGhpcy5mYWtlSGFuZGxlcikge1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVFdmVudExpc3RlbmVyKCdjbGljaycpO1xuICAgICAgICAgICAgdGhpcy5mYWtlSGFuZGxlciA9IG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5mYWtlRWxlbSkge1xuICAgICAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZCh0aGlzLmZha2VFbGVtKTtcbiAgICAgICAgICAgIHRoaXMuZmFrZUVsZW0gPSBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFNlbGVjdHMgdGhlIGNvbnRlbnQgZnJvbSBlbGVtZW50IHBhc3NlZCBvbiBgdGFyZ2V0YCBwcm9wZXJ0eS5cbiAgICAgKi9cblxuICAgIENsaXBib2FyZEFjdGlvbi5wcm90b3R5cGUuc2VsZWN0VGFyZ2V0ID0gZnVuY3Rpb24gc2VsZWN0VGFyZ2V0KCkge1xuICAgICAgICB0aGlzLnNlbGVjdGVkVGV4dCA9IF9zZWxlY3QyWydkZWZhdWx0J10odGhpcy50YXJnZXQpO1xuICAgICAgICB0aGlzLmNvcHlUZXh0KCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEV4ZWN1dGVzIHRoZSBjb3B5IG9wZXJhdGlvbiBiYXNlZCBvbiB0aGUgY3VycmVudCBzZWxlY3Rpb24uXG4gICAgICovXG5cbiAgICBDbGlwYm9hcmRBY3Rpb24ucHJvdG90eXBlLmNvcHlUZXh0ID0gZnVuY3Rpb24gY29weVRleHQoKSB7XG4gICAgICAgIHZhciBzdWNjZWVkZWQgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHN1Y2NlZWRlZCA9IGRvY3VtZW50LmV4ZWNDb21tYW5kKHRoaXMuYWN0aW9uKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBzdWNjZWVkZWQgPSBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuaGFuZGxlUmVzdWx0KHN1Y2NlZWRlZCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEZpcmVzIGFuIGV2ZW50IGJhc2VkIG9uIHRoZSBjb3B5IG9wZXJhdGlvbiByZXN1bHQuXG4gICAgICogQHBhcmFtIHtCb29sZWFufSBzdWNjZWVkZWRcbiAgICAgKi9cblxuICAgIENsaXBib2FyZEFjdGlvbi5wcm90b3R5cGUuaGFuZGxlUmVzdWx0ID0gZnVuY3Rpb24gaGFuZGxlUmVzdWx0KHN1Y2NlZWRlZCkge1xuICAgICAgICBpZiAoc3VjY2VlZGVkKSB7XG4gICAgICAgICAgICB0aGlzLmVtaXR0ZXIuZW1pdCgnc3VjY2VzcycsIHtcbiAgICAgICAgICAgICAgICBhY3Rpb246IHRoaXMuYWN0aW9uLFxuICAgICAgICAgICAgICAgIHRleHQ6IHRoaXMuc2VsZWN0ZWRUZXh0LFxuICAgICAgICAgICAgICAgIHRyaWdnZXI6IHRoaXMudHJpZ2dlcixcbiAgICAgICAgICAgICAgICBjbGVhclNlbGVjdGlvbjogdGhpcy5jbGVhclNlbGVjdGlvbi5iaW5kKHRoaXMpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5lbWl0KCdlcnJvcicsIHtcbiAgICAgICAgICAgICAgICBhY3Rpb246IHRoaXMuYWN0aW9uLFxuICAgICAgICAgICAgICAgIHRyaWdnZXI6IHRoaXMudHJpZ2dlcixcbiAgICAgICAgICAgICAgICBjbGVhclNlbGVjdGlvbjogdGhpcy5jbGVhclNlbGVjdGlvbi5iaW5kKHRoaXMpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIGN1cnJlbnQgc2VsZWN0aW9uIGFuZCBmb2N1cyBmcm9tIGB0YXJnZXRgIGVsZW1lbnQuXG4gICAgICovXG5cbiAgICBDbGlwYm9hcmRBY3Rpb24ucHJvdG90eXBlLmNsZWFyU2VsZWN0aW9uID0gZnVuY3Rpb24gY2xlYXJTZWxlY3Rpb24oKSB7XG4gICAgICAgIGlmICh0aGlzLnRhcmdldCkge1xuICAgICAgICAgICAgdGhpcy50YXJnZXQuYmx1cigpO1xuICAgICAgICB9XG5cbiAgICAgICAgd2luZG93LmdldFNlbGVjdGlvbigpLnJlbW92ZUFsbFJhbmdlcygpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBTZXRzIHRoZSBgYWN0aW9uYCB0byBiZSBwZXJmb3JtZWQgd2hpY2ggY2FuIGJlIGVpdGhlciAnY29weScgb3IgJ2N1dCcuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IGFjdGlvblxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRGVzdHJveSBsaWZlY3ljbGUuXG4gICAgICovXG5cbiAgICBDbGlwYm9hcmRBY3Rpb24ucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiBkZXN0cm95KCkge1xuICAgICAgICB0aGlzLnJlbW92ZUZha2UoKTtcbiAgICB9O1xuXG4gICAgX2NyZWF0ZUNsYXNzKENsaXBib2FyZEFjdGlvbiwgW3tcbiAgICAgICAga2V5OiAnYWN0aW9uJyxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiBzZXQoKSB7XG4gICAgICAgICAgICB2YXIgYWN0aW9uID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8gJ2NvcHknIDogYXJndW1lbnRzWzBdO1xuXG4gICAgICAgICAgICB0aGlzLl9hY3Rpb24gPSBhY3Rpb247XG5cbiAgICAgICAgICAgIGlmICh0aGlzLl9hY3Rpb24gIT09ICdjb3B5JyAmJiB0aGlzLl9hY3Rpb24gIT09ICdjdXQnKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFwiYWN0aW9uXCIgdmFsdWUsIHVzZSBlaXRoZXIgXCJjb3B5XCIgb3IgXCJjdXRcIicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHZXRzIHRoZSBgYWN0aW9uYCBwcm9wZXJ0eS5cbiAgICAgICAgICogQHJldHVybiB7U3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fYWN0aW9uO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFNldHMgdGhlIGB0YXJnZXRgIHByb3BlcnR5IHVzaW5nIGFuIGVsZW1lbnRcbiAgICAgICAgICogdGhhdCB3aWxsIGJlIGhhdmUgaXRzIGNvbnRlbnQgY29waWVkLlxuICAgICAgICAgKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICAgICAgICAgKi9cbiAgICB9LCB7XG4gICAgICAgIGtleTogJ3RhcmdldCcsXG4gICAgICAgIHNldDogZnVuY3Rpb24gc2V0KHRhcmdldCkge1xuICAgICAgICAgICAgaWYgKHRhcmdldCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgaWYgKHRhcmdldCAmJiB0eXBlb2YgdGFyZ2V0ID09PSAnb2JqZWN0JyAmJiB0YXJnZXQubm9kZVR5cGUgPT09IDEpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fdGFyZ2V0ID0gdGFyZ2V0O1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBcInRhcmdldFwiIHZhbHVlLCB1c2UgYSB2YWxpZCBFbGVtZW50Jyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHZXRzIHRoZSBgdGFyZ2V0YCBwcm9wZXJ0eS5cbiAgICAgICAgICogQHJldHVybiB7U3RyaW5nfEhUTUxFbGVtZW50fVxuICAgICAgICAgKi9cbiAgICAgICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fdGFyZ2V0O1xuICAgICAgICB9XG4gICAgfV0pO1xuXG4gICAgcmV0dXJuIENsaXBib2FyZEFjdGlvbjtcbn0pKCk7XG5cbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IENsaXBib2FyZEFjdGlvbjtcbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0c1snZGVmYXVsdCddOyIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfVxuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxuZnVuY3Rpb24gX2luaGVyaXRzKHN1YkNsYXNzLCBzdXBlckNsYXNzKSB7IGlmICh0eXBlb2Ygc3VwZXJDbGFzcyAhPT0gJ2Z1bmN0aW9uJyAmJiBzdXBlckNsYXNzICE9PSBudWxsKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ1N1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgJyArIHR5cGVvZiBzdXBlckNsYXNzKTsgfSBzdWJDbGFzcy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ2xhc3MgJiYgc3VwZXJDbGFzcy5wcm90b3R5cGUsIHsgY29uc3RydWN0b3I6IHsgdmFsdWU6IHN1YkNsYXNzLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IHRydWUsIGNvbmZpZ3VyYWJsZTogdHJ1ZSB9IH0pOyBpZiAoc3VwZXJDbGFzcykgT2JqZWN0LnNldFByb3RvdHlwZU9mID8gT2JqZWN0LnNldFByb3RvdHlwZU9mKHN1YkNsYXNzLCBzdXBlckNsYXNzKSA6IHN1YkNsYXNzLl9fcHJvdG9fXyA9IHN1cGVyQ2xhc3M7IH1cblxudmFyIF9jbGlwYm9hcmRBY3Rpb24gPSByZXF1aXJlKCcuL2NsaXBib2FyZC1hY3Rpb24nKTtcblxudmFyIF9jbGlwYm9hcmRBY3Rpb24yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY2xpcGJvYXJkQWN0aW9uKTtcblxudmFyIF90aW55RW1pdHRlciA9IHJlcXVpcmUoJ3RpbnktZW1pdHRlcicpO1xuXG52YXIgX3RpbnlFbWl0dGVyMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3RpbnlFbWl0dGVyKTtcblxudmFyIF9nb29kTGlzdGVuZXIgPSByZXF1aXJlKCdnb29kLWxpc3RlbmVyJyk7XG5cbnZhciBfZ29vZExpc3RlbmVyMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2dvb2RMaXN0ZW5lcik7XG5cbi8qKlxuICogQmFzZSBjbGFzcyB3aGljaCB0YWtlcyBvbmUgb3IgbW9yZSBlbGVtZW50cywgYWRkcyBldmVudCBsaXN0ZW5lcnMgdG8gdGhlbSxcbiAqIGFuZCBpbnN0YW50aWF0ZXMgYSBuZXcgYENsaXBib2FyZEFjdGlvbmAgb24gZWFjaCBjbGljay5cbiAqL1xuXG52YXIgQ2xpcGJvYXJkID0gKGZ1bmN0aW9uIChfRW1pdHRlcikge1xuICAgIF9pbmhlcml0cyhDbGlwYm9hcmQsIF9FbWl0dGVyKTtcblxuICAgIC8qKlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfEhUTUxFbGVtZW50fEhUTUxDb2xsZWN0aW9ufE5vZGVMaXN0fSB0cmlnZ2VyXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIENsaXBib2FyZCh0cmlnZ2VyLCBvcHRpb25zKSB7XG4gICAgICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBDbGlwYm9hcmQpO1xuXG4gICAgICAgIF9FbWl0dGVyLmNhbGwodGhpcyk7XG5cbiAgICAgICAgdGhpcy5yZXNvbHZlT3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgdGhpcy5saXN0ZW5DbGljayh0cmlnZ2VyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBIZWxwZXIgZnVuY3Rpb24gdG8gcmV0cmlldmUgYXR0cmlidXRlIHZhbHVlLlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfSBzdWZmaXhcbiAgICAgKiBAcGFyYW0ge0VsZW1lbnR9IGVsZW1lbnRcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgaWYgYXR0cmlidXRlcyB3b3VsZCBiZSByZXNvbHZlZCB1c2luZyBpbnRlcm5hbCBzZXR0ZXIgZnVuY3Rpb25zXG4gICAgICogb3IgY3VzdG9tIGZ1bmN0aW9ucyB0aGF0IHdlcmUgcGFzc2VkIGluIHRoZSBjb25zdHJ1Y3Rvci5cbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgICAqL1xuXG4gICAgQ2xpcGJvYXJkLnByb3RvdHlwZS5yZXNvbHZlT3B0aW9ucyA9IGZ1bmN0aW9uIHJlc29sdmVPcHRpb25zKCkge1xuICAgICAgICB2YXIgb3B0aW9ucyA9IGFyZ3VtZW50cy5sZW5ndGggPD0gMCB8fCBhcmd1bWVudHNbMF0gPT09IHVuZGVmaW5lZCA/IHt9IDogYXJndW1lbnRzWzBdO1xuXG4gICAgICAgIHRoaXMuYWN0aW9uID0gdHlwZW9mIG9wdGlvbnMuYWN0aW9uID09PSAnZnVuY3Rpb24nID8gb3B0aW9ucy5hY3Rpb24gOiB0aGlzLmRlZmF1bHRBY3Rpb247XG4gICAgICAgIHRoaXMudGFyZ2V0ID0gdHlwZW9mIG9wdGlvbnMudGFyZ2V0ID09PSAnZnVuY3Rpb24nID8gb3B0aW9ucy50YXJnZXQgOiB0aGlzLmRlZmF1bHRUYXJnZXQ7XG4gICAgICAgIHRoaXMudGV4dCA9IHR5cGVvZiBvcHRpb25zLnRleHQgPT09ICdmdW5jdGlvbicgPyBvcHRpb25zLnRleHQgOiB0aGlzLmRlZmF1bHRUZXh0O1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBBZGRzIGEgY2xpY2sgZXZlbnQgbGlzdGVuZXIgdG8gdGhlIHBhc3NlZCB0cmlnZ2VyLlxuICAgICAqIEBwYXJhbSB7U3RyaW5nfEhUTUxFbGVtZW50fEhUTUxDb2xsZWN0aW9ufE5vZGVMaXN0fSB0cmlnZ2VyXG4gICAgICovXG5cbiAgICBDbGlwYm9hcmQucHJvdG90eXBlLmxpc3RlbkNsaWNrID0gZnVuY3Rpb24gbGlzdGVuQ2xpY2sodHJpZ2dlcikge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgICAgIHRoaXMubGlzdGVuZXIgPSBfZ29vZExpc3RlbmVyMlsnZGVmYXVsdCddKHRyaWdnZXIsICdjbGljaycsIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICByZXR1cm4gX3RoaXMub25DbGljayhlKTtcbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgYSBuZXcgYENsaXBib2FyZEFjdGlvbmAgb24gZWFjaCBjbGljayBldmVudC5cbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICovXG5cbiAgICBDbGlwYm9hcmQucHJvdG90eXBlLm9uQ2xpY2sgPSBmdW5jdGlvbiBvbkNsaWNrKGUpIHtcbiAgICAgICAgdmFyIHRyaWdnZXIgPSBlLmRlbGVnYXRlVGFyZ2V0IHx8IGUuY3VycmVudFRhcmdldDtcblxuICAgICAgICBpZiAodGhpcy5jbGlwYm9hcmRBY3Rpb24pIHtcbiAgICAgICAgICAgIHRoaXMuY2xpcGJvYXJkQWN0aW9uID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuY2xpcGJvYXJkQWN0aW9uID0gbmV3IF9jbGlwYm9hcmRBY3Rpb24yWydkZWZhdWx0J10oe1xuICAgICAgICAgICAgYWN0aW9uOiB0aGlzLmFjdGlvbih0cmlnZ2VyKSxcbiAgICAgICAgICAgIHRhcmdldDogdGhpcy50YXJnZXQodHJpZ2dlciksXG4gICAgICAgICAgICB0ZXh0OiB0aGlzLnRleHQodHJpZ2dlciksXG4gICAgICAgICAgICB0cmlnZ2VyOiB0cmlnZ2VyLFxuICAgICAgICAgICAgZW1pdHRlcjogdGhpc1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRGVmYXVsdCBgYWN0aW9uYCBsb29rdXAgZnVuY3Rpb24uXG4gICAgICogQHBhcmFtIHtFbGVtZW50fSB0cmlnZ2VyXG4gICAgICovXG5cbiAgICBDbGlwYm9hcmQucHJvdG90eXBlLmRlZmF1bHRBY3Rpb24gPSBmdW5jdGlvbiBkZWZhdWx0QWN0aW9uKHRyaWdnZXIpIHtcbiAgICAgICAgcmV0dXJuIGdldEF0dHJpYnV0ZVZhbHVlKCdhY3Rpb24nLCB0cmlnZ2VyKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRGVmYXVsdCBgdGFyZ2V0YCBsb29rdXAgZnVuY3Rpb24uXG4gICAgICogQHBhcmFtIHtFbGVtZW50fSB0cmlnZ2VyXG4gICAgICovXG5cbiAgICBDbGlwYm9hcmQucHJvdG90eXBlLmRlZmF1bHRUYXJnZXQgPSBmdW5jdGlvbiBkZWZhdWx0VGFyZ2V0KHRyaWdnZXIpIHtcbiAgICAgICAgdmFyIHNlbGVjdG9yID0gZ2V0QXR0cmlidXRlVmFsdWUoJ3RhcmdldCcsIHRyaWdnZXIpO1xuXG4gICAgICAgIGlmIChzZWxlY3Rvcikge1xuICAgICAgICAgICAgcmV0dXJuIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIERlZmF1bHQgYHRleHRgIGxvb2t1cCBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0ge0VsZW1lbnR9IHRyaWdnZXJcbiAgICAgKi9cblxuICAgIENsaXBib2FyZC5wcm90b3R5cGUuZGVmYXVsdFRleHQgPSBmdW5jdGlvbiBkZWZhdWx0VGV4dCh0cmlnZ2VyKSB7XG4gICAgICAgIHJldHVybiBnZXRBdHRyaWJ1dGVWYWx1ZSgndGV4dCcsIHRyaWdnZXIpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95IGxpZmVjeWNsZS5cbiAgICAgKi9cblxuICAgIENsaXBib2FyZC5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMubGlzdGVuZXIuZGVzdHJveSgpO1xuXG4gICAgICAgIGlmICh0aGlzLmNsaXBib2FyZEFjdGlvbikge1xuICAgICAgICAgICAgdGhpcy5jbGlwYm9hcmRBY3Rpb24uZGVzdHJveSgpO1xuICAgICAgICAgICAgdGhpcy5jbGlwYm9hcmRBY3Rpb24gPSBudWxsO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHJldHVybiBDbGlwYm9hcmQ7XG59KShfdGlueUVtaXR0ZXIyWydkZWZhdWx0J10pO1xuXG5mdW5jdGlvbiBnZXRBdHRyaWJ1dGVWYWx1ZShzdWZmaXgsIGVsZW1lbnQpIHtcbiAgICB2YXIgYXR0cmlidXRlID0gJ2RhdGEtY2xpcGJvYXJkLScgKyBzdWZmaXg7XG5cbiAgICBpZiAoIWVsZW1lbnQuaGFzQXR0cmlidXRlKGF0dHJpYnV0ZSkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHJldHVybiBlbGVtZW50LmdldEF0dHJpYnV0ZShhdHRyaWJ1dGUpO1xufVxuXG5leHBvcnRzWydkZWZhdWx0J10gPSBDbGlwYm9hcmQ7XG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHNbJ2RlZmF1bHQnXTsiLCJ2YXIgbWF0Y2hlcyA9IHJlcXVpcmUoJ21hdGNoZXMtc2VsZWN0b3InKVxyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZWxlbWVudCwgc2VsZWN0b3IsIGNoZWNrWW9TZWxmKSB7XHJcbiAgdmFyIHBhcmVudCA9IGNoZWNrWW9TZWxmID8gZWxlbWVudCA6IGVsZW1lbnQucGFyZW50Tm9kZVxyXG5cclxuICB3aGlsZSAocGFyZW50ICYmIHBhcmVudCAhPT0gZG9jdW1lbnQpIHtcclxuICAgIGlmIChtYXRjaGVzKHBhcmVudCwgc2VsZWN0b3IpKSByZXR1cm4gcGFyZW50O1xyXG4gICAgcGFyZW50ID0gcGFyZW50LnBhcmVudE5vZGVcclxuICB9XHJcbn1cclxuIiwidmFyIGNsb3Nlc3QgPSByZXF1aXJlKCdjbG9zZXN0Jyk7XG5cbi8qKlxuICogRGVsZWdhdGVzIGV2ZW50IHRvIGEgc2VsZWN0b3IuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbGVtZW50XG4gKiBAcGFyYW0ge1N0cmluZ30gc2VsZWN0b3JcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHBhcmFtIHtCb29sZWFufSB1c2VDYXB0dXJlXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cbmZ1bmN0aW9uIGRlbGVnYXRlKGVsZW1lbnQsIHNlbGVjdG9yLCB0eXBlLCBjYWxsYmFjaywgdXNlQ2FwdHVyZSkge1xuICAgIHZhciBsaXN0ZW5lckZuID0gbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lckZuLCB1c2VDYXB0dXJlKTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGxpc3RlbmVyRm4sIHVzZUNhcHR1cmUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIEZpbmRzIGNsb3Nlc3QgbWF0Y2ggYW5kIGludm9rZXMgY2FsbGJhY2suXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbGVtZW50XG4gKiBAcGFyYW0ge1N0cmluZ30gc2VsZWN0b3JcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cbmZ1bmN0aW9uIGxpc3RlbmVyKGVsZW1lbnQsIHNlbGVjdG9yLCB0eXBlLCBjYWxsYmFjaykge1xuICAgIHJldHVybiBmdW5jdGlvbihlKSB7XG4gICAgICAgIGUuZGVsZWdhdGVUYXJnZXQgPSBjbG9zZXN0KGUudGFyZ2V0LCBzZWxlY3RvciwgdHJ1ZSk7XG5cbiAgICAgICAgaWYgKGUuZGVsZWdhdGVUYXJnZXQpIHtcbiAgICAgICAgICAgIGNhbGxiYWNrLmNhbGwoZWxlbWVudCwgZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZGVsZWdhdGU7XG4iLCIvKiFcbiAqIGRvY1JlYWR5IHYxLjAuM1xuICogQ3Jvc3MgYnJvd3NlciBET01Db250ZW50TG9hZGVkIGV2ZW50IGVtaXR0ZXJcbiAqIE1JVCBsaWNlbnNlXG4gKi9cblxuLypqc2hpbnQgYnJvd3NlcjogdHJ1ZSwgc3RyaWN0OiB0cnVlLCB1bmRlZjogdHJ1ZSwgdW51c2VkOiB0cnVlKi9cbi8qZ2xvYmFsIGRlZmluZTogZmFsc2UsIHJlcXVpcmU6IGZhbHNlLCBtb2R1bGU6IGZhbHNlICovXG5cbiggZnVuY3Rpb24oIHdpbmRvdyApIHtcblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZG9jdW1lbnQgPSB3aW5kb3cuZG9jdW1lbnQ7XG4vLyBjb2xsZWN0aW9uIG9mIGZ1bmN0aW9ucyB0byBiZSB0cmlnZ2VyZWQgb24gcmVhZHlcbnZhciBxdWV1ZSA9IFtdO1xuXG5mdW5jdGlvbiBkb2NSZWFkeSggZm4gKSB7XG4gIC8vIHRocm93IG91dCBub24tZnVuY3Rpb25zXG4gIGlmICggdHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nICkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmICggZG9jUmVhZHkuaXNSZWFkeSApIHtcbiAgICAvLyByZWFkeSBub3csIGhpdCBpdFxuICAgIGZuKCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gcXVldWUgZnVuY3Rpb24gd2hlbiByZWFkeVxuICAgIHF1ZXVlLnB1c2goIGZuICk7XG4gIH1cbn1cblxuZG9jUmVhZHkuaXNSZWFkeSA9IGZhbHNlO1xuXG4vLyB0cmlnZ2VyZWQgb24gdmFyaW91cyBkb2MgcmVhZHkgZXZlbnRzXG5mdW5jdGlvbiBpbml0KCBldmVudCApIHtcbiAgLy8gYmFpbCBpZiBJRTggZG9jdW1lbnQgaXMgbm90IHJlYWR5IGp1c3QgeWV0XG4gIHZhciBpc0lFOE5vdFJlYWR5ID0gZXZlbnQudHlwZSA9PT0gJ3JlYWR5c3RhdGVjaGFuZ2UnICYmIGRvY3VtZW50LnJlYWR5U3RhdGUgIT09ICdjb21wbGV0ZSc7XG4gIGlmICggZG9jUmVhZHkuaXNSZWFkeSB8fCBpc0lFOE5vdFJlYWR5ICkge1xuICAgIHJldHVybjtcbiAgfVxuICBkb2NSZWFkeS5pc1JlYWR5ID0gdHJ1ZTtcblxuICAvLyBwcm9jZXNzIHF1ZXVlXG4gIGZvciAoIHZhciBpPTAsIGxlbiA9IHF1ZXVlLmxlbmd0aDsgaSA8IGxlbjsgaSsrICkge1xuICAgIHZhciBmbiA9IHF1ZXVlW2ldO1xuICAgIGZuKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZGVmaW5lRG9jUmVhZHkoIGV2ZW50aWUgKSB7XG4gIGV2ZW50aWUuYmluZCggZG9jdW1lbnQsICdET01Db250ZW50TG9hZGVkJywgaW5pdCApO1xuICBldmVudGllLmJpbmQoIGRvY3VtZW50LCAncmVhZHlzdGF0ZWNoYW5nZScsIGluaXQgKTtcbiAgZXZlbnRpZS5iaW5kKCB3aW5kb3csICdsb2FkJywgaW5pdCApO1xuXG4gIHJldHVybiBkb2NSZWFkeTtcbn1cblxuLy8gdHJhbnNwb3J0XG5pZiAoIHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCApIHtcbiAgLy8gQU1EXG4gIC8vIGlmIFJlcXVpcmVKUywgdGhlbiBkb2MgaXMgYWxyZWFkeSByZWFkeVxuICBkb2NSZWFkeS5pc1JlYWR5ID0gdHlwZW9mIHJlcXVpcmVqcyA9PT0gJ2Z1bmN0aW9uJztcbiAgZGVmaW5lKCBbICdldmVudGllL2V2ZW50aWUnIF0sIGRlZmluZURvY1JlYWR5ICk7XG59IGVsc2UgaWYgKCB0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gZGVmaW5lRG9jUmVhZHkoIHJlcXVpcmUoJ2V2ZW50aWUnKSApO1xufSBlbHNlIHtcbiAgLy8gYnJvd3NlciBnbG9iYWxcbiAgd2luZG93LmRvY1JlYWR5ID0gZGVmaW5lRG9jUmVhZHkoIHdpbmRvdy5ldmVudGllICk7XG59XG5cbn0pKCB3aW5kb3cgKTtcbiIsIi8qIVxuICogZXZlbnRpZSB2MS4wLjZcbiAqIGV2ZW50IGJpbmRpbmcgaGVscGVyXG4gKiAgIGV2ZW50aWUuYmluZCggZWxlbSwgJ2NsaWNrJywgbXlGbiApXG4gKiAgIGV2ZW50aWUudW5iaW5kKCBlbGVtLCAnY2xpY2snLCBteUZuIClcbiAqIE1JVCBsaWNlbnNlXG4gKi9cblxuLypqc2hpbnQgYnJvd3NlcjogdHJ1ZSwgdW5kZWY6IHRydWUsIHVudXNlZDogdHJ1ZSAqL1xuLypnbG9iYWwgZGVmaW5lOiBmYWxzZSwgbW9kdWxlOiBmYWxzZSAqL1xuXG4oIGZ1bmN0aW9uKCB3aW5kb3cgKSB7XG5cbid1c2Ugc3RyaWN0JztcblxudmFyIGRvY0VsZW0gPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG5cbnZhciBiaW5kID0gZnVuY3Rpb24oKSB7fTtcblxuZnVuY3Rpb24gZ2V0SUVFdmVudCggb2JqICkge1xuICB2YXIgZXZlbnQgPSB3aW5kb3cuZXZlbnQ7XG4gIC8vIGFkZCBldmVudC50YXJnZXRcbiAgZXZlbnQudGFyZ2V0ID0gZXZlbnQudGFyZ2V0IHx8IGV2ZW50LnNyY0VsZW1lbnQgfHwgb2JqO1xuICByZXR1cm4gZXZlbnQ7XG59XG5cbmlmICggZG9jRWxlbS5hZGRFdmVudExpc3RlbmVyICkge1xuICBiaW5kID0gZnVuY3Rpb24oIG9iaiwgdHlwZSwgZm4gKSB7XG4gICAgb2JqLmFkZEV2ZW50TGlzdGVuZXIoIHR5cGUsIGZuLCBmYWxzZSApO1xuICB9O1xufSBlbHNlIGlmICggZG9jRWxlbS5hdHRhY2hFdmVudCApIHtcbiAgYmluZCA9IGZ1bmN0aW9uKCBvYmosIHR5cGUsIGZuICkge1xuICAgIG9ialsgdHlwZSArIGZuIF0gPSBmbi5oYW5kbGVFdmVudCA/XG4gICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGV2ZW50ID0gZ2V0SUVFdmVudCggb2JqICk7XG4gICAgICAgIGZuLmhhbmRsZUV2ZW50LmNhbGwoIGZuLCBldmVudCApO1xuICAgICAgfSA6XG4gICAgICBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGV2ZW50ID0gZ2V0SUVFdmVudCggb2JqICk7XG4gICAgICAgIGZuLmNhbGwoIG9iaiwgZXZlbnQgKTtcbiAgICAgIH07XG4gICAgb2JqLmF0dGFjaEV2ZW50KCBcIm9uXCIgKyB0eXBlLCBvYmpbIHR5cGUgKyBmbiBdICk7XG4gIH07XG59XG5cbnZhciB1bmJpbmQgPSBmdW5jdGlvbigpIHt9O1xuXG5pZiAoIGRvY0VsZW0ucmVtb3ZlRXZlbnRMaXN0ZW5lciApIHtcbiAgdW5iaW5kID0gZnVuY3Rpb24oIG9iaiwgdHlwZSwgZm4gKSB7XG4gICAgb2JqLnJlbW92ZUV2ZW50TGlzdGVuZXIoIHR5cGUsIGZuLCBmYWxzZSApO1xuICB9O1xufSBlbHNlIGlmICggZG9jRWxlbS5kZXRhY2hFdmVudCApIHtcbiAgdW5iaW5kID0gZnVuY3Rpb24oIG9iaiwgdHlwZSwgZm4gKSB7XG4gICAgb2JqLmRldGFjaEV2ZW50KCBcIm9uXCIgKyB0eXBlLCBvYmpbIHR5cGUgKyBmbiBdICk7XG4gICAgdHJ5IHtcbiAgICAgIGRlbGV0ZSBvYmpbIHR5cGUgKyBmbiBdO1xuICAgIH0gY2F0Y2ggKCBlcnIgKSB7XG4gICAgICAvLyBjYW4ndCBkZWxldGUgd2luZG93IG9iamVjdCBwcm9wZXJ0aWVzXG4gICAgICBvYmpbIHR5cGUgKyBmbiBdID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfTtcbn1cblxudmFyIGV2ZW50aWUgPSB7XG4gIGJpbmQ6IGJpbmQsXG4gIHVuYmluZDogdW5iaW5kXG59O1xuXG4vLyAtLS0tLSBtb2R1bGUgZGVmaW5pdGlvbiAtLS0tLSAvL1xuXG5pZiAoIHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCApIHtcbiAgLy8gQU1EXG4gIGRlZmluZSggZXZlbnRpZSApO1xufSBlbHNlIGlmICggdHlwZW9mIGV4cG9ydHMgPT09ICdvYmplY3QnICkge1xuICAvLyBDb21tb25KU1xuICBtb2R1bGUuZXhwb3J0cyA9IGV2ZW50aWU7XG59IGVsc2Uge1xuICAvLyBicm93c2VyIGdsb2JhbFxuICB3aW5kb3cuZXZlbnRpZSA9IGV2ZW50aWU7XG59XG5cbn0pKCB3aW5kb3cgKTtcbiIsIi8qKlxuICogQ2hlY2sgaWYgYXJndW1lbnQgaXMgYSBIVE1MIGVsZW1lbnQuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5leHBvcnRzLm5vZGUgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSAhPT0gdW5kZWZpbmVkXG4gICAgICAgICYmIHZhbHVlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnRcbiAgICAgICAgJiYgdmFsdWUubm9kZVR5cGUgPT09IDE7XG59O1xuXG4vKipcbiAqIENoZWNrIGlmIGFyZ3VtZW50IGlzIGEgbGlzdCBvZiBIVE1MIGVsZW1lbnRzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuZXhwb3J0cy5ub2RlTGlzdCA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHR5cGUgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpO1xuXG4gICAgcmV0dXJuIHZhbHVlICE9PSB1bmRlZmluZWRcbiAgICAgICAgJiYgKHR5cGUgPT09ICdbb2JqZWN0IE5vZGVMaXN0XScgfHwgdHlwZSA9PT0gJ1tvYmplY3QgSFRNTENvbGxlY3Rpb25dJylcbiAgICAgICAgJiYgKCdsZW5ndGgnIGluIHZhbHVlKVxuICAgICAgICAmJiAodmFsdWUubGVuZ3RoID09PSAwIHx8IGV4cG9ydHMubm9kZSh2YWx1ZVswXSkpO1xufTtcblxuLyoqXG4gKiBDaGVjayBpZiBhcmd1bWVudCBpcyBhIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbmV4cG9ydHMuc3RyaW5nID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJ1xuICAgICAgICB8fCB2YWx1ZSBpbnN0YW5jZW9mIFN0cmluZztcbn07XG5cbi8qKlxuICogQ2hlY2sgaWYgYXJndW1lbnQgaXMgYSBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbmV4cG9ydHMuZm4gPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHZhciB0eXBlID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKTtcblxuICAgIHJldHVybiB0eXBlID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xufTtcbiIsInZhciBpcyA9IHJlcXVpcmUoJy4vaXMnKTtcbnZhciBkZWxlZ2F0ZSA9IHJlcXVpcmUoJ2RlbGVnYXRlJyk7XG5cbi8qKlxuICogVmFsaWRhdGVzIGFsbCBwYXJhbXMgYW5kIGNhbGxzIHRoZSByaWdodFxuICogbGlzdGVuZXIgZnVuY3Rpb24gYmFzZWQgb24gaXRzIHRhcmdldCB0eXBlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfEhUTUxFbGVtZW50fEhUTUxDb2xsZWN0aW9ufE5vZGVMaXN0fSB0YXJnZXRcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5mdW5jdGlvbiBsaXN0ZW4odGFyZ2V0LCB0eXBlLCBjYWxsYmFjaykge1xuICAgIGlmICghdGFyZ2V0ICYmICF0eXBlICYmICFjYWxsYmFjaykge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NpbmcgcmVxdWlyZWQgYXJndW1lbnRzJyk7XG4gICAgfVxuXG4gICAgaWYgKCFpcy5zdHJpbmcodHlwZSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignU2Vjb25kIGFyZ3VtZW50IG11c3QgYmUgYSBTdHJpbmcnKTtcbiAgICB9XG5cbiAgICBpZiAoIWlzLmZuKGNhbGxiYWNrKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdUaGlyZCBhcmd1bWVudCBtdXN0IGJlIGEgRnVuY3Rpb24nKTtcbiAgICB9XG5cbiAgICBpZiAoaXMubm9kZSh0YXJnZXQpKSB7XG4gICAgICAgIHJldHVybiBsaXN0ZW5Ob2RlKHRhcmdldCwgdHlwZSwgY2FsbGJhY2spO1xuICAgIH1cbiAgICBlbHNlIGlmIChpcy5ub2RlTGlzdCh0YXJnZXQpKSB7XG4gICAgICAgIHJldHVybiBsaXN0ZW5Ob2RlTGlzdCh0YXJnZXQsIHR5cGUsIGNhbGxiYWNrKTtcbiAgICB9XG4gICAgZWxzZSBpZiAoaXMuc3RyaW5nKHRhcmdldCkpIHtcbiAgICAgICAgcmV0dXJuIGxpc3RlblNlbGVjdG9yKHRhcmdldCwgdHlwZSwgY2FsbGJhY2spO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIFN0cmluZywgSFRNTEVsZW1lbnQsIEhUTUxDb2xsZWN0aW9uLCBvciBOb2RlTGlzdCcpO1xuICAgIH1cbn1cblxuLyoqXG4gKiBBZGRzIGFuIGV2ZW50IGxpc3RlbmVyIHRvIGEgSFRNTCBlbGVtZW50XG4gKiBhbmQgcmV0dXJucyBhIHJlbW92ZSBsaXN0ZW5lciBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZnVuY3Rpb24gbGlzdGVuTm9kZShub2RlLCB0eXBlLCBjYWxsYmFjaykge1xuICAgIG5vZGUuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBjYWxsYmFjayk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBkZXN0cm95OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogQWRkIGFuIGV2ZW50IGxpc3RlbmVyIHRvIGEgbGlzdCBvZiBIVE1MIGVsZW1lbnRzXG4gKiBhbmQgcmV0dXJucyBhIHJlbW92ZSBsaXN0ZW5lciBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge05vZGVMaXN0fEhUTUxDb2xsZWN0aW9ufSBub2RlTGlzdFxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cbmZ1bmN0aW9uIGxpc3Rlbk5vZGVMaXN0KG5vZGVMaXN0LCB0eXBlLCBjYWxsYmFjaykge1xuICAgIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwobm9kZUxpc3QsIGZ1bmN0aW9uKG5vZGUpIHtcbiAgICAgICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChub2RlTGlzdCwgZnVuY3Rpb24obm9kZSkge1xuICAgICAgICAgICAgICAgIG5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBjYWxsYmFjayk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiBBZGQgYW4gZXZlbnQgbGlzdGVuZXIgdG8gYSBzZWxlY3RvclxuICogYW5kIHJldHVybnMgYSByZW1vdmUgbGlzdGVuZXIgZnVuY3Rpb24uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHNlbGVjdG9yXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZnVuY3Rpb24gbGlzdGVuU2VsZWN0b3Ioc2VsZWN0b3IsIHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIGRlbGVnYXRlKGRvY3VtZW50LmJvZHksIHNlbGVjdG9yLCB0eXBlLCBjYWxsYmFjayk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGlzdGVuO1xuIiwiXHJcbi8qKlxyXG4gKiBFbGVtZW50IHByb3RvdHlwZS5cclxuICovXHJcblxyXG52YXIgcHJvdG8gPSBFbGVtZW50LnByb3RvdHlwZTtcclxuXHJcbi8qKlxyXG4gKiBWZW5kb3IgZnVuY3Rpb24uXHJcbiAqL1xyXG5cclxudmFyIHZlbmRvciA9IHByb3RvLm1hdGNoZXNTZWxlY3RvclxyXG4gIHx8IHByb3RvLndlYmtpdE1hdGNoZXNTZWxlY3RvclxyXG4gIHx8IHByb3RvLm1vek1hdGNoZXNTZWxlY3RvclxyXG4gIHx8IHByb3RvLm1zTWF0Y2hlc1NlbGVjdG9yXHJcbiAgfHwgcHJvdG8ub01hdGNoZXNTZWxlY3RvcjtcclxuXHJcbi8qKlxyXG4gKiBFeHBvc2UgYG1hdGNoKClgLlxyXG4gKi9cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gbWF0Y2g7XHJcblxyXG4vKipcclxuICogTWF0Y2ggYGVsYCB0byBgc2VsZWN0b3JgLlxyXG4gKlxyXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXHJcbiAqIEBwYXJhbSB7U3RyaW5nfSBzZWxlY3RvclxyXG4gKiBAcmV0dXJuIHtCb29sZWFufVxyXG4gKiBAYXBpIHB1YmxpY1xyXG4gKi9cclxuXHJcbmZ1bmN0aW9uIG1hdGNoKGVsLCBzZWxlY3Rvcikge1xyXG4gIGlmICh2ZW5kb3IpIHJldHVybiB2ZW5kb3IuY2FsbChlbCwgc2VsZWN0b3IpO1xyXG4gIHZhciBub2RlcyA9IGVsLnBhcmVudE5vZGUucXVlcnlTZWxlY3RvckFsbChzZWxlY3Rvcik7XHJcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7ICsraSkge1xyXG4gICAgaWYgKG5vZGVzW2ldID09IGVsKSByZXR1cm4gdHJ1ZTtcclxuICB9XHJcbiAgcmV0dXJuIGZhbHNlO1xyXG59IiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcbnZhciBxdWV1ZSA9IFtdO1xudmFyIGRyYWluaW5nID0gZmFsc2U7XG52YXIgY3VycmVudFF1ZXVlO1xudmFyIHF1ZXVlSW5kZXggPSAtMTtcblxuZnVuY3Rpb24gY2xlYW5VcE5leHRUaWNrKCkge1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgaWYgKGN1cnJlbnRRdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgcXVldWUgPSBjdXJyZW50UXVldWUuY29uY2F0KHF1ZXVlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgfVxuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgICAgZHJhaW5RdWV1ZSgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZHJhaW5RdWV1ZSgpIHtcbiAgICBpZiAoZHJhaW5pbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGltZW91dCA9IHNldFRpbWVvdXQoY2xlYW5VcE5leHRUaWNrKTtcbiAgICBkcmFpbmluZyA9IHRydWU7XG5cbiAgICB2YXIgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIHdoaWxlKGxlbikge1xuICAgICAgICBjdXJyZW50UXVldWUgPSBxdWV1ZTtcbiAgICAgICAgcXVldWUgPSBbXTtcbiAgICAgICAgd2hpbGUgKCsrcXVldWVJbmRleCA8IGxlbikge1xuICAgICAgICAgICAgaWYgKGN1cnJlbnRRdWV1ZSkge1xuICAgICAgICAgICAgICAgIGN1cnJlbnRRdWV1ZVtxdWV1ZUluZGV4XS5ydW4oKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBxdWV1ZUluZGV4ID0gLTE7XG4gICAgICAgIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB9XG4gICAgY3VycmVudFF1ZXVlID0gbnVsbDtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbn1cblxucHJvY2Vzcy5uZXh0VGljayA9IGZ1bmN0aW9uIChmdW4pIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoIC0gMSk7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPiAxKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgfVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKG5ldyBJdGVtKGZ1biwgYXJncykpO1xuICAgIGlmIChxdWV1ZS5sZW5ndGggPT09IDEgJiYgIWRyYWluaW5nKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZHJhaW5RdWV1ZSwgMCk7XG4gICAgfVxufTtcblxuLy8gdjggbGlrZXMgcHJlZGljdGlibGUgb2JqZWN0c1xuZnVuY3Rpb24gSXRlbShmdW4sIGFycmF5KSB7XG4gICAgdGhpcy5mdW4gPSBmdW47XG4gICAgdGhpcy5hcnJheSA9IGFycmF5O1xufVxuSXRlbS5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuZnVuLmFwcGx5KG51bGwsIHRoaXMuYXJyYXkpO1xufTtcbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xucHJvY2Vzcy52ZXJzaW9uID0gJyc7IC8vIGVtcHR5IHN0cmluZyB0byBhdm9pZCByZWdleHAgaXNzdWVzXG5wcm9jZXNzLnZlcnNpb25zID0ge307XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5wcm9jZXNzLm9uID0gbm9vcDtcbnByb2Nlc3MuYWRkTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5vbmNlID0gbm9vcDtcbnByb2Nlc3Mub2ZmID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVBbGxMaXN0ZW5lcnMgPSBub29wO1xucHJvY2Vzcy5lbWl0ID0gbm9vcDtcblxucHJvY2Vzcy5iaW5kaW5nID0gZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuYmluZGluZyBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuXG5wcm9jZXNzLmN3ZCA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuICcvJyB9O1xucHJvY2Vzcy5jaGRpciA9IGZ1bmN0aW9uIChkaXIpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3Byb2Nlc3MuY2hkaXIgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcbnByb2Nlc3MudW1hc2sgPSBmdW5jdGlvbigpIHsgcmV0dXJuIDA7IH07XG4iLCJmdW5jdGlvbiBzZWxlY3QoZWxlbWVudCkge1xuICAgIHZhciBzZWxlY3RlZFRleHQ7XG5cbiAgICBpZiAoZWxlbWVudC5ub2RlTmFtZSA9PT0gJ0lOUFVUJyB8fCBlbGVtZW50Lm5vZGVOYW1lID09PSAnVEVYVEFSRUEnKSB7XG4gICAgICAgIGVsZW1lbnQuZm9jdXMoKTtcbiAgICAgICAgZWxlbWVudC5zZXRTZWxlY3Rpb25SYW5nZSgwLCBlbGVtZW50LnZhbHVlLmxlbmd0aCk7XG5cbiAgICAgICAgc2VsZWN0ZWRUZXh0ID0gZWxlbWVudC52YWx1ZTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICAgIGlmIChlbGVtZW50Lmhhc0F0dHJpYnV0ZSgnY29udGVudGVkaXRhYmxlJykpIHtcbiAgICAgICAgICAgIGVsZW1lbnQuZm9jdXMoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBzZWxlY3Rpb24gPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XG4gICAgICAgIHZhciByYW5nZSA9IGRvY3VtZW50LmNyZWF0ZVJhbmdlKCk7XG5cbiAgICAgICAgcmFuZ2Uuc2VsZWN0Tm9kZUNvbnRlbnRzKGVsZW1lbnQpO1xuICAgICAgICBzZWxlY3Rpb24ucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gICAgICAgIHNlbGVjdGlvbi5hZGRSYW5nZShyYW5nZSk7XG5cbiAgICAgICAgc2VsZWN0ZWRUZXh0ID0gc2VsZWN0aW9uLnRvU3RyaW5nKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHNlbGVjdGVkVGV4dDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzZWxlY3Q7XG4iLCJmdW5jdGlvbiBFICgpIHtcblx0Ly8gS2VlcCB0aGlzIGVtcHR5IHNvIGl0J3MgZWFzaWVyIHRvIGluaGVyaXQgZnJvbVxuICAvLyAodmlhIGh0dHBzOi8vZ2l0aHViLmNvbS9saXBzbWFjayBmcm9tIGh0dHBzOi8vZ2l0aHViLmNvbS9zY290dGNvcmdhbi90aW55LWVtaXR0ZXIvaXNzdWVzLzMpXG59XG5cbkUucHJvdG90eXBlID0ge1xuXHRvbjogZnVuY3Rpb24gKG5hbWUsIGNhbGxiYWNrLCBjdHgpIHtcbiAgICB2YXIgZSA9IHRoaXMuZSB8fCAodGhpcy5lID0ge30pO1xuXG4gICAgKGVbbmFtZV0gfHwgKGVbbmFtZV0gPSBbXSkpLnB1c2goe1xuICAgICAgZm46IGNhbGxiYWNrLFxuICAgICAgY3R4OiBjdHhcbiAgICB9KTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9LFxuXG4gIG9uY2U6IGZ1bmN0aW9uIChuYW1lLCBjYWxsYmFjaywgY3R4KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGZ1bmN0aW9uIGxpc3RlbmVyICgpIHtcbiAgICAgIHNlbGYub2ZmKG5hbWUsIGxpc3RlbmVyKTtcbiAgICAgIGNhbGxiYWNrLmFwcGx5KGN0eCwgYXJndW1lbnRzKTtcbiAgICB9O1xuXG4gICAgbGlzdGVuZXIuXyA9IGNhbGxiYWNrXG4gICAgcmV0dXJuIHRoaXMub24obmFtZSwgbGlzdGVuZXIsIGN0eCk7XG4gIH0sXG5cbiAgZW1pdDogZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB2YXIgZGF0YSA9IFtdLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcbiAgICB2YXIgZXZ0QXJyID0gKCh0aGlzLmUgfHwgKHRoaXMuZSA9IHt9KSlbbmFtZV0gfHwgW10pLnNsaWNlKCk7XG4gICAgdmFyIGkgPSAwO1xuICAgIHZhciBsZW4gPSBldnRBcnIubGVuZ3RoO1xuXG4gICAgZm9yIChpOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGV2dEFycltpXS5mbi5hcHBseShldnRBcnJbaV0uY3R4LCBkYXRhKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICBvZmY6IGZ1bmN0aW9uIChuYW1lLCBjYWxsYmFjaykge1xuICAgIHZhciBlID0gdGhpcy5lIHx8ICh0aGlzLmUgPSB7fSk7XG4gICAgdmFyIGV2dHMgPSBlW25hbWVdO1xuICAgIHZhciBsaXZlRXZlbnRzID0gW107XG5cbiAgICBpZiAoZXZ0cyAmJiBjYWxsYmFjaykge1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGV2dHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgaWYgKGV2dHNbaV0uZm4gIT09IGNhbGxiYWNrICYmIGV2dHNbaV0uZm4uXyAhPT0gY2FsbGJhY2spXG4gICAgICAgICAgbGl2ZUV2ZW50cy5wdXNoKGV2dHNbaV0pO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFJlbW92ZSBldmVudCBmcm9tIHF1ZXVlIHRvIHByZXZlbnQgbWVtb3J5IGxlYWtcbiAgICAvLyBTdWdnZXN0ZWQgYnkgaHR0cHM6Ly9naXRodWIuY29tL2xhemRcbiAgICAvLyBSZWY6IGh0dHBzOi8vZ2l0aHViLmNvbS9zY290dGNvcmdhbi90aW55LWVtaXR0ZXIvY29tbWl0L2M2ZWJmYWE5YmM5NzNiMzNkMTEwYTg0YTMwNzc0MmI3Y2Y5NGM5NTMjY29tbWl0Y29tbWVudC01MDI0OTEwXG5cbiAgICAobGl2ZUV2ZW50cy5sZW5ndGgpXG4gICAgICA/IGVbbmFtZV0gPSBsaXZlRXZlbnRzXG4gICAgICA6IGRlbGV0ZSBlW25hbWVdO1xuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRTtcbiIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcblxudmFyIF9jcmVhdGVDb21wb25lbnQgPSByZXF1aXJlKCcuL2NyZWF0ZUNvbXBvbmVudCcpO1xuXG52YXIgX2NyZWF0ZUNvbXBvbmVudDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jcmVhdGVDb21wb25lbnQpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG5leHBvcnRzLmRlZmF1bHQgPSAoMCwgX2NyZWF0ZUNvbXBvbmVudDIuZGVmYXVsdCkoKTsiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG52YXIgdWEgPSBnbG9iYWwubmF2aWdhdG9yID8gZ2xvYmFsLm5hdmlnYXRvci51c2VyQWdlbnQgOiAnJztcblxudmFyIGlzVHJpZGVudCA9IGV4cG9ydHMuaXNUcmlkZW50ID0gdWEuaW5kZXhPZignVHJpZGVudCcpID4gLTE7XG52YXIgaXNFZGdlID0gZXhwb3J0cy5pc0VkZ2UgPSB1YS5pbmRleE9mKCdFZGdlJykgPiAtMTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBfdHlwZW9mID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBTeW1ib2wuaXRlcmF0b3IgPT09IFwic3ltYm9sXCIgPyBmdW5jdGlvbiAob2JqKSB7IHJldHVybiB0eXBlb2Ygb2JqOyB9IDogZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gb2JqICYmIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvYmouY29uc3RydWN0b3IgPT09IFN5bWJvbCA/IFwic3ltYm9sXCIgOiB0eXBlb2Ygb2JqOyB9O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGZ1bmN0aW9uIChhdHRyTmFtZSkge1xuICAgIHJldHVybiBhdHRyc0NmZ1thdHRyTmFtZV0gfHwgREVGQVVMVF9BVFRSX0NGRztcbn07XG5cbnZhciBfZXNjYXBlQXR0ciA9IHJlcXVpcmUoJy4uL3V0aWxzL2VzY2FwZUF0dHInKTtcblxudmFyIF9lc2NhcGVBdHRyMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2VzY2FwZUF0dHIpO1xuXG52YXIgX2lzSW5BcnJheSA9IHJlcXVpcmUoJy4uL3V0aWxzL2lzSW5BcnJheScpO1xuXG52YXIgX2lzSW5BcnJheTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9pc0luQXJyYXkpO1xuXG52YXIgX2Rhc2hlcml6ZSA9IHJlcXVpcmUoJy4uL3V0aWxzL2Rhc2hlcml6ZScpO1xuXG52YXIgX2Rhc2hlcml6ZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9kYXNoZXJpemUpO1xuXG52YXIgX2NvbnNvbGUgPSByZXF1aXJlKCcuLi91dGlscy9jb25zb2xlJyk7XG5cbnZhciBfY29uc29sZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jb25zb2xlKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcblxuZnVuY3Rpb24gc2V0QXR0cihub2RlLCBuYW1lLCB2YWwpIHtcbiAgICBpZiAobmFtZSA9PT0gJ3R5cGUnICYmIG5vZGUudGFnTmFtZSA9PT0gJ0lOUFVUJykge1xuICAgICAgICB2YXIgdmFsdWUgPSBub2RlLnZhbHVlOyAvLyB2YWx1ZSB3aWxsIGJlIGxvc3QgaW4gSUUgaWYgdHlwZSBpcyBjaGFuZ2VkXG4gICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKG5hbWUsICcnICsgdmFsKTtcbiAgICAgICAgbm9kZS52YWx1ZSA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG5vZGUuc2V0QXR0cmlidXRlKEFUVFJfTkFNRVNbbmFtZV0gfHwgbmFtZSwgJycgKyB2YWwpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gc2V0Qm9vbGVhbkF0dHIobm9kZSwgbmFtZSwgdmFsKSB7XG4gICAgaWYgKHZhbCkge1xuICAgICAgICBzZXRBdHRyKG5vZGUsIG5hbWUsIHZhbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmVtb3ZlQXR0cihub2RlLCBuYW1lKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNldFByb3Aobm9kZSwgbmFtZSwgdmFsKSB7XG4gICAgbm9kZVtuYW1lXSA9IHZhbDtcbn1cblxuZnVuY3Rpb24gc2V0T2JqUHJvcChub2RlLCBuYW1lLCB2YWwpIHtcbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICB2YXIgdHlwZU9mVmFsID0gdHlwZW9mIHZhbCA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YodmFsKTtcbiAgICAgICAgaWYgKHR5cGVPZlZhbCAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIF9jb25zb2xlMi5kZWZhdWx0LmVycm9yKCdcIicgKyBuYW1lICsgJ1wiIGF0dHJpYnV0ZSBleHBlY3RzIGFuIG9iamVjdCBhcyBhIHZhbHVlLCBub3QgYSAnICsgdHlwZU9mVmFsKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBwcm9wID0gbm9kZVtuYW1lXTtcbiAgICBmb3IgKHZhciBpIGluIHZhbCkge1xuICAgICAgICBwcm9wW2ldID0gdmFsW2ldID09IG51bGwgPyAnJyA6IHZhbFtpXTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNldFByb3BXaXRoQ2hlY2sobm9kZSwgbmFtZSwgdmFsKSB7XG4gICAgaWYgKG5hbWUgPT09ICd2YWx1ZScgJiYgbm9kZS50YWdOYW1lID09PSAnU0VMRUNUJykge1xuICAgICAgICBzZXRTZWxlY3RWYWx1ZShub2RlLCB2YWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIG5vZGVbbmFtZV0gIT09IHZhbCAmJiAobm9kZVtuYW1lXSA9IHZhbCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmVBdHRyKG5vZGUsIG5hbWUpIHtcbiAgICBub2RlLnJlbW92ZUF0dHJpYnV0ZShBVFRSX05BTUVTW25hbWVdIHx8IG5hbWUpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVQcm9wKG5vZGUsIG5hbWUpIHtcbiAgICBpZiAobmFtZSA9PT0gJ3N0eWxlJykge1xuICAgICAgICBub2RlW25hbWVdLmNzc1RleHQgPSAnJztcbiAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICd2YWx1ZScgJiYgbm9kZS50YWdOYW1lID09PSAnU0VMRUNUJykge1xuICAgICAgICByZW1vdmVTZWxlY3RWYWx1ZShub2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBub2RlW25hbWVdID0gZ2V0RGVmYXVsdFByb3BWYWwobm9kZS50YWdOYW1lLCBuYW1lKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNldFNlbGVjdFZhbHVlKG5vZGUsIHZhbHVlKSB7XG4gICAgdmFyIGlzTXVsdGlwbGUgPSBBcnJheS5pc0FycmF5KHZhbHVlKSxcbiAgICAgICAgb3B0aW9ucyA9IG5vZGUub3B0aW9ucyxcbiAgICAgICAgbGVuID0gb3B0aW9ucy5sZW5ndGg7XG5cbiAgICB2YXIgaSA9IDAsXG4gICAgICAgIG9wdGlvbk5vZGUgPSB1bmRlZmluZWQ7XG5cbiAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgICBvcHRpb25Ob2RlID0gb3B0aW9uc1tpKytdO1xuICAgICAgICBvcHRpb25Ob2RlLnNlbGVjdGVkID0gdmFsdWUgIT0gbnVsbCAmJiAoaXNNdWx0aXBsZSA/ICgwLCBfaXNJbkFycmF5Mi5kZWZhdWx0KSh2YWx1ZSwgb3B0aW9uTm9kZS52YWx1ZSkgOiBvcHRpb25Ob2RlLnZhbHVlID09IHZhbHVlKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZVNlbGVjdFZhbHVlKG5vZGUpIHtcbiAgICB2YXIgb3B0aW9ucyA9IG5vZGUub3B0aW9ucyxcbiAgICAgICAgbGVuID0gb3B0aW9ucy5sZW5ndGg7XG5cbiAgICB2YXIgaSA9IDA7XG5cbiAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgICBvcHRpb25zW2krK10uc2VsZWN0ZWQgPSBmYWxzZTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGF0dHJUb1N0cmluZyhuYW1lLCB2YWx1ZSkge1xuICAgIHJldHVybiAoQVRUUl9OQU1FU1tuYW1lXSB8fCBuYW1lKSArICc9XCInICsgKDAsIF9lc2NhcGVBdHRyMi5kZWZhdWx0KSh2YWx1ZSkgKyAnXCInO1xufVxuXG5mdW5jdGlvbiBib29sZWFuQXR0clRvU3RyaW5nKG5hbWUsIHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID8gbmFtZSA6ICcnO1xufVxuXG5mdW5jdGlvbiBzdHlsZVByb3BUb1N0cmluZyhuYW1lLCB2YWx1ZSkge1xuICAgIHZhciBzdHlsZXMgPSAnJztcblxuICAgIGZvciAodmFyIGkgaW4gdmFsdWUpIHtcbiAgICAgICAgdmFsdWVbaV0gIT0gbnVsbCAmJiAoc3R5bGVzICs9ICgwLCBfZGFzaGVyaXplMi5kZWZhdWx0KShpKSArICc6JyArIHZhbHVlW2ldICsgJzsnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3R5bGVzID8gbmFtZSArICc9XCInICsgc3R5bGVzICsgJ1wiJyA6IHN0eWxlcztcbn1cblxudmFyIGRlZmF1bHRQcm9wVmFscyA9IHt9O1xuZnVuY3Rpb24gZ2V0RGVmYXVsdFByb3BWYWwodGFnLCBhdHRyTmFtZSkge1xuICAgIHZhciB0YWdBdHRycyA9IGRlZmF1bHRQcm9wVmFsc1t0YWddIHx8IChkZWZhdWx0UHJvcFZhbHNbdGFnXSA9IHt9KTtcbiAgICByZXR1cm4gYXR0ck5hbWUgaW4gdGFnQXR0cnMgPyB0YWdBdHRyc1thdHRyTmFtZV0gOiB0YWdBdHRyc1thdHRyTmFtZV0gPSBkb2MuY3JlYXRlRWxlbWVudCh0YWcpW2F0dHJOYW1lXTtcbn1cblxudmFyIEFUVFJfTkFNRVMgPSB7XG4gICAgYWNjZXB0Q2hhcnNldDogJ2FjY2VwdC1jaGFyc2V0JyxcbiAgICBjbGFzc05hbWU6ICdjbGFzcycsXG4gICAgaHRtbEZvcjogJ2ZvcicsXG4gICAgaHR0cEVxdWl2OiAnaHR0cC1lcXVpdicsXG4gICAgYXV0b0NhcGl0YWxpemU6ICdhdXRvY2FwaXRhbGl6ZScsXG4gICAgYXV0b0NvbXBsZXRlOiAnYXV0b2NvbXBsZXRlJyxcbiAgICBhdXRvQ29ycmVjdDogJ2F1dG9jb3JyZWN0JyxcbiAgICBhdXRvRm9jdXM6ICdhdXRvZm9jdXMnLFxuICAgIGF1dG9QbGF5OiAnYXV0b3BsYXknLFxuICAgIGVuY1R5cGU6ICdlbmNvZGluZycsXG4gICAgaHJlZkxhbmc6ICdocmVmbGFuZycsXG4gICAgcmFkaW9Hcm91cDogJ3JhZGlvZ3JvdXAnLFxuICAgIHNwZWxsQ2hlY2s6ICdzcGVsbGNoZWNrJyxcbiAgICBzcmNEb2M6ICdzcmNkb2MnLFxuICAgIHNyY1NldDogJ3NyY3NldCcsXG4gICAgdGFiSW5kZXg6ICd0YWJpbmRleCdcbn0sXG4gICAgREVGQVVMVF9BVFRSX0NGRyA9IHtcbiAgICBzZXQ6IHNldEF0dHIsXG4gICAgcmVtb3ZlOiByZW1vdmVBdHRyLFxuICAgIHRvU3RyaW5nOiBhdHRyVG9TdHJpbmdcbn0sXG4gICAgQk9PTEVBTl9BVFRSX0NGRyA9IHtcbiAgICBzZXQ6IHNldEJvb2xlYW5BdHRyLFxuICAgIHJlbW92ZTogcmVtb3ZlQXR0cixcbiAgICB0b1N0cmluZzogYm9vbGVhbkF0dHJUb1N0cmluZ1xufSxcbiAgICBERUZBVUxUX1BST1BfQ0ZHID0ge1xuICAgIHNldDogc2V0UHJvcCxcbiAgICByZW1vdmU6IHJlbW92ZVByb3AsXG4gICAgdG9TdHJpbmc6IGF0dHJUb1N0cmluZ1xufSxcbiAgICBCT09MRUFOX1BST1BfQ0ZHID0ge1xuICAgIHNldDogc2V0UHJvcCxcbiAgICByZW1vdmU6IHJlbW92ZVByb3AsXG4gICAgdG9TdHJpbmc6IGJvb2xlYW5BdHRyVG9TdHJpbmdcbn0sXG4gICAgYXR0cnNDZmcgPSB7XG4gICAgY2hlY2tlZDogQk9PTEVBTl9QUk9QX0NGRyxcbiAgICBjb250cm9sczogREVGQVVMVF9QUk9QX0NGRyxcbiAgICBkaXNhYmxlZDogQk9PTEVBTl9BVFRSX0NGRyxcbiAgICBpZDogREVGQVVMVF9QUk9QX0NGRyxcbiAgICBpc21hcDogQk9PTEVBTl9BVFRSX0NGRyxcbiAgICBsb29wOiBERUZBVUxUX1BST1BfQ0ZHLFxuICAgIG11bHRpcGxlOiBCT09MRUFOX1BST1BfQ0ZHLFxuICAgIG11dGVkOiBERUZBVUxUX1BST1BfQ0ZHLFxuICAgIG9wZW46IEJPT0xFQU5fQVRUUl9DRkcsXG4gICAgcmVhZE9ubHk6IEJPT0xFQU5fUFJPUF9DRkcsXG4gICAgc2VsZWN0ZWQ6IEJPT0xFQU5fUFJPUF9DRkcsXG4gICAgc3JjRG9jOiBERUZBVUxUX1BST1BfQ0ZHLFxuICAgIHN0eWxlOiB7XG4gICAgICAgIHNldDogc2V0T2JqUHJvcCxcbiAgICAgICAgcmVtb3ZlOiByZW1vdmVQcm9wLFxuICAgICAgICB0b1N0cmluZzogc3R5bGVQcm9wVG9TdHJpbmdcbiAgICB9LFxuICAgIHZhbHVlOiB7XG4gICAgICAgIHNldDogc2V0UHJvcFdpdGhDaGVjayxcbiAgICAgICAgcmVtb3ZlOiByZW1vdmVQcm9wLFxuICAgICAgICB0b1N0cmluZzogYXR0clRvU3RyaW5nXG4gICAgfVxufTsiLCJcInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0cy5kZWZhdWx0ID0gU3ludGhldGljRXZlbnQ7XG5mdW5jdGlvbiBTeW50aGV0aWNFdmVudCh0eXBlLCBuYXRpdmVFdmVudCkge1xuICAgIHRoaXMudHlwZSA9IHR5cGU7XG4gICAgdGhpcy50YXJnZXQgPSBuYXRpdmVFdmVudC50YXJnZXQ7XG4gICAgdGhpcy5uYXRpdmVFdmVudCA9IG5hdGl2ZUV2ZW50O1xuXG4gICAgdGhpcy5faXNQcm9wYWdhdGlvblN0b3BwZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9pc0RlZmF1bHRQcmV2ZW50ZWQgPSBmYWxzZTtcbn1cblxuU3ludGhldGljRXZlbnQucHJvdG90eXBlID0ge1xuICAgIHN0b3BQcm9wYWdhdGlvbjogZnVuY3Rpb24gc3RvcFByb3BhZ2F0aW9uKCkge1xuICAgICAgICB0aGlzLl9pc1Byb3BhZ2F0aW9uU3RvcHBlZCA9IHRydWU7XG5cbiAgICAgICAgdmFyIG5hdGl2ZUV2ZW50ID0gdGhpcy5uYXRpdmVFdmVudDtcbiAgICAgICAgbmF0aXZlRXZlbnQuc3RvcFByb3BhZ2F0aW9uID8gbmF0aXZlRXZlbnQuc3RvcFByb3BhZ2F0aW9uKCkgOiBuYXRpdmVFdmVudC5jYW5jZWxCdWJibGUgPSB0cnVlO1xuICAgIH0sXG4gICAgaXNQcm9wYWdhdGlvblN0b3BwZWQ6IGZ1bmN0aW9uIGlzUHJvcGFnYXRpb25TdG9wcGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNQcm9wYWdhdGlvblN0b3BwZWQ7XG4gICAgfSxcbiAgICBwcmV2ZW50RGVmYXVsdDogZnVuY3Rpb24gcHJldmVudERlZmF1bHQoKSB7XG4gICAgICAgIHRoaXMuX2lzRGVmYXVsdFByZXZlbnRlZCA9IHRydWU7XG5cbiAgICAgICAgdmFyIG5hdGl2ZUV2ZW50ID0gdGhpcy5uYXRpdmVFdmVudDtcbiAgICAgICAgbmF0aXZlRXZlbnQucHJldmVudERlZmF1bHQgPyBuYXRpdmVFdmVudC5wcmV2ZW50RGVmYXVsdCgpIDogbmF0aXZlRXZlbnQucmV0dXJuVmFsdWUgPSBmYWxzZTtcbiAgICB9LFxuICAgIGlzRGVmYXVsdFByZXZlbnRlZDogZnVuY3Rpb24gaXNEZWZhdWx0UHJldmVudGVkKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faXNEZWZhdWx0UHJldmVudGVkO1xuICAgIH1cbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLmRlZmF1bHQgPSB7XG4gICAgb25Nb3VzZU92ZXI6ICdtb3VzZW92ZXInLFxuICAgIG9uTW91c2VNb3ZlOiAnbW91c2Vtb3ZlJyxcbiAgICBvbk1vdXNlT3V0OiAnbW91c2VvdXQnLFxuICAgIG9uTW91c2VEb3duOiAnbW91c2Vkb3duJyxcbiAgICBvbk1vdXNlVXA6ICdtb3VzZXVwJyxcbiAgICBvbkNsaWNrOiAnY2xpY2snLFxuICAgIG9uRGJsQ2xpY2s6ICdkYmxjbGljaycsXG4gICAgb25LZXlEb3duOiAna2V5ZG93bicsXG4gICAgb25LZXlQcmVzczogJ2tleXByZXNzJyxcbiAgICBvbktleVVwOiAna2V5dXAnLFxuICAgIG9uQ2hhbmdlOiAnY2hhbmdlJyxcbiAgICBvbklucHV0OiAnaW5wdXQnLFxuICAgIG9uU3VibWl0OiAnc3VibWl0JyxcbiAgICBvbkZvY3VzOiAnZm9jdXMnLFxuICAgIG9uQmx1cjogJ2JsdXInLFxuICAgIG9uU2Nyb2xsOiAnc2Nyb2xsJyxcbiAgICBvbkxvYWQ6ICdsb2FkJyxcbiAgICBvbkVycm9yOiAnZXJyb3InLFxuICAgIG9uQ29udGV4dE1lbnU6ICdjb250ZXh0bWVudScsXG4gICAgb25EcmFnU3RhcnQ6ICdkcmFnc3RhcnQnLFxuICAgIG9uRHJhZzogJ2RyYWcnLFxuICAgIG9uRHJhZ0VudGVyOiAnZHJhZ2VudGVyJyxcbiAgICBvbkRyYWdPdmVyOiAnZHJhZ292ZXInLFxuICAgIG9uRHJhZ0xlYXZlOiAnZHJhZ2xlYXZlJyxcbiAgICBvbkRyYWdFbmQ6ICdkcmFnZW5kJyxcbiAgICBvbkRyb3A6ICdkcm9wJyxcbiAgICBvbldoZWVsOiAnd2hlZWwnLFxuICAgIG9uQ29weTogJ2NvcHknLFxuICAgIG9uQ3V0OiAnY3V0JyxcbiAgICBvblBhc3RlOiAncGFzdGUnXG59OyIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0cy5yZW1vdmVMaXN0ZW5lcnMgPSBleHBvcnRzLnJlbW92ZUxpc3RlbmVyID0gZXhwb3J0cy5hZGRMaXN0ZW5lciA9IHVuZGVmaW5lZDtcblxudmFyIF9pc0V2ZW50U3VwcG9ydGVkID0gcmVxdWlyZSgnLi9pc0V2ZW50U3VwcG9ydGVkJyk7XG5cbnZhciBfaXNFdmVudFN1cHBvcnRlZDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9pc0V2ZW50U3VwcG9ydGVkKTtcblxudmFyIF9TeW50aGV0aWNFdmVudCA9IHJlcXVpcmUoJy4vU3ludGhldGljRXZlbnQnKTtcblxudmFyIF9TeW50aGV0aWNFdmVudDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9TeW50aGV0aWNFdmVudCk7XG5cbnZhciBfZ2V0RG9tTm9kZUlkID0gcmVxdWlyZSgnLi4vZ2V0RG9tTm9kZUlkJyk7XG5cbnZhciBfZ2V0RG9tTm9kZUlkMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2dldERvbU5vZGVJZCk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQsXG4gICAgQlVCQkxFQUJMRV9OQVRJVkVfRVZFTlRTID0gWydtb3VzZW92ZXInLCAnbW91c2Vtb3ZlJywgJ21vdXNlb3V0JywgJ21vdXNlZG93bicsICdtb3VzZXVwJywgJ2NsaWNrJywgJ2RibGNsaWNrJywgJ2tleWRvd24nLCAna2V5cHJlc3MnLCAna2V5dXAnLCAnY2hhbmdlJywgJ2lucHV0JywgJ3N1Ym1pdCcsICdmb2N1cycsICdibHVyJywgJ2RyYWdzdGFydCcsICdkcmFnJywgJ2RyYWdlbnRlcicsICdkcmFnb3ZlcicsICdkcmFnbGVhdmUnLCAnZHJhZ2VuZCcsICdkcm9wJywgJ2NvbnRleHRtZW51JywgJ3doZWVsJywgJ2NvcHknLCAnY3V0JywgJ3Bhc3RlJ10sXG4gICAgTk9OX0JVQkJMRUFCTEVfTkFUSVZFX0VWRU5UUyA9IFsnc2Nyb2xsJywgJ2xvYWQnLCAnZXJyb3InXTtcblxudmFyIGxpc3RlbmVyc1N0b3JhZ2UgPSB7fSxcbiAgICBldmVudHNDZmcgPSB7fTtcblxuZnVuY3Rpb24gZ2xvYmFsRXZlbnRMaXN0ZW5lcihlLCB0eXBlKSB7XG4gICAgdHlwZSB8fCAodHlwZSA9IGUudHlwZSk7XG5cbiAgICB2YXIgY2ZnID0gZXZlbnRzQ2ZnW3R5cGVdLFxuICAgICAgICBsaXN0ZW5lcnNUb0ludm9rZSA9IFtdO1xuXG4gICAgdmFyIHRhcmdldCA9IGUudGFyZ2V0LFxuICAgICAgICBsaXN0ZW5lcnNDb3VudCA9IGNmZy5saXN0ZW5lcnNDb3VudGVyLFxuICAgICAgICBsaXN0ZW5lcnMgPSB1bmRlZmluZWQsXG4gICAgICAgIGxpc3RlbmVyID0gdW5kZWZpbmVkLFxuICAgICAgICBkb21Ob2RlSWQgPSB1bmRlZmluZWQ7XG5cbiAgICB3aGlsZSAobGlzdGVuZXJzQ291bnQgPiAwICYmIHRhcmdldCAmJiB0YXJnZXQgIT09IGRvYykge1xuICAgICAgICBpZiAoZG9tTm9kZUlkID0gKDAsIF9nZXREb21Ob2RlSWQyLmRlZmF1bHQpKHRhcmdldCwgdHJ1ZSkpIHtcbiAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVyc1N0b3JhZ2VbZG9tTm9kZUlkXTtcbiAgICAgICAgICAgIGlmIChsaXN0ZW5lcnMgJiYgKGxpc3RlbmVyID0gbGlzdGVuZXJzW3R5cGVdKSkge1xuICAgICAgICAgICAgICAgIGxpc3RlbmVyc1RvSW52b2tlLnB1c2gobGlzdGVuZXIpO1xuICAgICAgICAgICAgICAgIC0tbGlzdGVuZXJzQ291bnQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICB0YXJnZXQgPSB0YXJnZXQucGFyZW50Tm9kZTtcbiAgICB9XG5cbiAgICBpZiAobGlzdGVuZXJzVG9JbnZva2UubGVuZ3RoKSB7XG4gICAgICAgIHZhciBldmVudCA9IG5ldyBfU3ludGhldGljRXZlbnQyLmRlZmF1bHQodHlwZSwgZSksXG4gICAgICAgICAgICBsZW4gPSBsaXN0ZW5lcnNUb0ludm9rZS5sZW5ndGg7XG5cbiAgICAgICAgdmFyIGkgPSAwO1xuXG4gICAgICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICAgICAgICBsaXN0ZW5lcnNUb0ludm9rZVtpKytdKGV2ZW50KTtcbiAgICAgICAgICAgIGlmIChldmVudC5pc1Byb3BhZ2F0aW9uU3RvcHBlZCgpKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGV2ZW50TGlzdGVuZXIoZSkge1xuICAgIGxpc3RlbmVyc1N0b3JhZ2VbKDAsIF9nZXREb21Ob2RlSWQyLmRlZmF1bHQpKGUudGFyZ2V0KV1bZS50eXBlXShuZXcgX1N5bnRoZXRpY0V2ZW50Mi5kZWZhdWx0KGUudHlwZSwgZSkpO1xufVxuXG5pZiAoZG9jKSB7XG4gICAgKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGZvY3VzRXZlbnRzID0ge1xuICAgICAgICAgICAgZm9jdXM6ICdmb2N1c2luJyxcbiAgICAgICAgICAgIGJsdXI6ICdmb2N1c291dCdcbiAgICAgICAgfTtcblxuICAgICAgICB2YXIgaSA9IDAsXG4gICAgICAgICAgICB0eXBlID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIHdoaWxlIChpIDwgQlVCQkxFQUJMRV9OQVRJVkVfRVZFTlRTLmxlbmd0aCkge1xuICAgICAgICAgICAgdHlwZSA9IEJVQkJMRUFCTEVfTkFUSVZFX0VWRU5UU1tpKytdO1xuICAgICAgICAgICAgZXZlbnRzQ2ZnW3R5cGVdID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgICAgICAgICAgYnViYmxlczogdHJ1ZSxcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnNDb3VudGVyOiAwLFxuICAgICAgICAgICAgICAgIHNldDogZmFsc2UsXG4gICAgICAgICAgICAgICAgc2V0dXA6IGZvY3VzRXZlbnRzW3R5cGVdID8gKDAsIF9pc0V2ZW50U3VwcG9ydGVkMi5kZWZhdWx0KShmb2N1c0V2ZW50c1t0eXBlXSkgPyBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciB0eXBlID0gdGhpcy50eXBlO1xuICAgICAgICAgICAgICAgICAgICBkb2MuYWRkRXZlbnRMaXN0ZW5lcihmb2N1c0V2ZW50c1t0eXBlXSwgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGdsb2JhbEV2ZW50TGlzdGVuZXIoZSwgdHlwZSk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGRvYy5hZGRFdmVudExpc3RlbmVyKHRoaXMudHlwZSwgZ2xvYmFsRXZlbnRMaXN0ZW5lciwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgfSA6IG51bGxcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpID0gMDtcbiAgICAgICAgd2hpbGUgKGkgPCBOT05fQlVCQkxFQUJMRV9OQVRJVkVfRVZFTlRTLmxlbmd0aCkge1xuICAgICAgICAgICAgZXZlbnRzQ2ZnW05PTl9CVUJCTEVBQkxFX05BVElWRV9FVkVOVFNbaSsrXV0gPSB7XG4gICAgICAgICAgICAgICAgdHlwZTogdHlwZSxcbiAgICAgICAgICAgICAgICBidWJibGVzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBzZXQ6IGZhbHNlXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgfSkoKTtcbn1cblxuZnVuY3Rpb24gYWRkTGlzdGVuZXIoZG9tTm9kZSwgdHlwZSwgbGlzdGVuZXIpIHtcbiAgICB2YXIgY2ZnID0gZXZlbnRzQ2ZnW3R5cGVdO1xuICAgIGlmIChjZmcpIHtcbiAgICAgICAgaWYgKCFjZmcuc2V0KSB7XG4gICAgICAgICAgICBjZmcuc2V0dXAgPyBjZmcuc2V0dXAoKSA6IGNmZy5idWJibGVzICYmIGRvYy5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGdsb2JhbEV2ZW50TGlzdGVuZXIsIGZhbHNlKTtcbiAgICAgICAgICAgIGNmZy5zZXQgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGRvbU5vZGVJZCA9ICgwLCBfZ2V0RG9tTm9kZUlkMi5kZWZhdWx0KShkb21Ob2RlKSxcbiAgICAgICAgICAgIGxpc3RlbmVycyA9IGxpc3RlbmVyc1N0b3JhZ2VbZG9tTm9kZUlkXSB8fCAobGlzdGVuZXJzU3RvcmFnZVtkb21Ob2RlSWRdID0ge30pO1xuXG4gICAgICAgIGlmICghbGlzdGVuZXJzW3R5cGVdKSB7XG4gICAgICAgICAgICBjZmcuYnViYmxlcyA/ICsrY2ZnLmxpc3RlbmVyc0NvdW50ZXIgOiBkb21Ob2RlLmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgZXZlbnRMaXN0ZW5lciwgZmFsc2UpO1xuICAgICAgICB9XG5cbiAgICAgICAgbGlzdGVuZXJzW3R5cGVdID0gbGlzdGVuZXI7XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmVMaXN0ZW5lcihkb21Ob2RlLCB0eXBlKSB7XG4gICAgdmFyIGRvbU5vZGVJZCA9ICgwLCBfZ2V0RG9tTm9kZUlkMi5kZWZhdWx0KShkb21Ob2RlLCB0cnVlKTtcblxuICAgIGlmIChkb21Ob2RlSWQpIHtcbiAgICAgICAgdmFyIGxpc3RlbmVycyA9IGxpc3RlbmVyc1N0b3JhZ2VbZG9tTm9kZUlkXTtcblxuICAgICAgICBpZiAobGlzdGVuZXJzICYmIGxpc3RlbmVyc1t0eXBlXSkge1xuICAgICAgICAgICAgbGlzdGVuZXJzW3R5cGVdID0gbnVsbDtcblxuICAgICAgICAgICAgdmFyIGNmZyA9IGV2ZW50c0NmZ1t0eXBlXTtcblxuICAgICAgICAgICAgaWYgKGNmZykge1xuICAgICAgICAgICAgICAgIGNmZy5idWJibGVzID8gLS1jZmcubGlzdGVuZXJzQ291bnRlciA6IGRvbU5vZGUucmVtb3ZlRXZlbnRMaXN0ZW5lcih0eXBlLCBldmVudExpc3RlbmVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlTGlzdGVuZXJzKGRvbU5vZGUpIHtcbiAgICB2YXIgZG9tTm9kZUlkID0gKDAsIF9nZXREb21Ob2RlSWQyLmRlZmF1bHQpKGRvbU5vZGUsIHRydWUpO1xuXG4gICAgaWYgKGRvbU5vZGVJZCkge1xuICAgICAgICB2YXIgbGlzdGVuZXJzID0gbGlzdGVuZXJzU3RvcmFnZVtkb21Ob2RlSWRdO1xuXG4gICAgICAgIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgIGRlbGV0ZSBsaXN0ZW5lcnNTdG9yYWdlW2RvbU5vZGVJZF07XG4gICAgICAgICAgICBmb3IgKHZhciB0eXBlIGluIGxpc3RlbmVycykge1xuICAgICAgICAgICAgICAgIHJlbW92ZUxpc3RlbmVyKGRvbU5vZGUsIHR5cGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5leHBvcnRzLmFkZExpc3RlbmVyID0gYWRkTGlzdGVuZXI7XG5leHBvcnRzLnJlbW92ZUxpc3RlbmVyID0gcmVtb3ZlTGlzdGVuZXI7XG5leHBvcnRzLnJlbW92ZUxpc3RlbmVycyA9IHJlbW92ZUxpc3RlbmVyczsiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG5cbmZ1bmN0aW9uIGlzRXZlbnRTdXBwb3J0ZWQodHlwZSkge1xuICAgIHZhciBldmVudFByb3AgPSAnb24nICsgdHlwZTtcblxuICAgIGlmIChldmVudFByb3AgaW4gZG9jKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHZhciBkb21Ob2RlID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gICAgZG9tTm9kZS5zZXRBdHRyaWJ1dGUoZXZlbnRQcm9wLCAncmV0dXJuOycpO1xuICAgIGlmICh0eXBlb2YgZG9tTm9kZVtldmVudFByb3BdID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiB0eXBlID09PSAnd2hlZWwnICYmIGRvYy5pbXBsZW1lbnRhdGlvbiAmJiBkb2MuaW1wbGVtZW50YXRpb24uaGFzRmVhdHVyZSAmJiBkb2MuaW1wbGVtZW50YXRpb24uaGFzRmVhdHVyZSgnJywgJycpICE9PSB0cnVlICYmIGRvYy5pbXBsZW1lbnRhdGlvbi5oYXNGZWF0dXJlKCdFdmVudHMud2hlZWwnLCAnMy4wJyk7XG59XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGlzRXZlbnRTdXBwb3J0ZWQ7IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG52YXIgSURfUFJPUCA9ICdfX3ZpZG9tX19pZF9fJztcbnZhciBjb3VudGVyID0gMTtcblxuZnVuY3Rpb24gZ2V0RG9tTm9kZUlkKG5vZGUsIG9ubHlHZXQpIHtcbiAgICByZXR1cm4gbm9kZVtJRF9QUk9QXSB8fCAob25seUdldCA/IG51bGwgOiBub2RlW0lEX1BST1BdID0gY291bnRlcisrKTtcbn1cblxuZXhwb3J0cy5kZWZhdWx0ID0gZ2V0RG9tTm9kZUlkOyIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0cy5tb3VudFRvRG9tID0gbW91bnRUb0RvbTtcbmV4cG9ydHMubW91bnRUb0RvbVN5bmMgPSBtb3VudFRvRG9tU3luYztcbmV4cG9ydHMudW5tb3VudEZyb21Eb20gPSB1bm1vdW50RnJvbURvbTtcbmV4cG9ydHMudW5tb3VudEZyb21Eb21TeW5jID0gdW5tb3VudEZyb21Eb21TeW5jO1xuXG52YXIgX2dldERvbU5vZGVJZCA9IHJlcXVpcmUoJy4vZ2V0RG9tTm9kZUlkJyk7XG5cbnZhciBfZ2V0RG9tTm9kZUlkMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2dldERvbU5vZGVJZCk7XG5cbnZhciBfcmFmQmF0Y2ggPSByZXF1aXJlKCcuL3JhZkJhdGNoJyk7XG5cbnZhciBfcmFmQmF0Y2gyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfcmFmQmF0Y2gpO1xuXG52YXIgX2VtcHR5T2JqID0gcmVxdWlyZSgnLi4vdXRpbHMvZW1wdHlPYmonKTtcblxudmFyIF9lbXB0eU9iajIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9lbXB0eU9iaik7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbnZhciBtb3VudGVkTm9kZXMgPSB7fTtcbnZhciBjb3VudGVyID0gMDtcblxuZnVuY3Rpb24gbW91bnQoZG9tTm9kZSwgdHJlZSwgY2IsIGNiQ3R4LCBzeW5jTW9kZSkge1xuICAgIHZhciBkb21Ob2RlSWQgPSAoMCwgX2dldERvbU5vZGVJZDIuZGVmYXVsdCkoZG9tTm9kZSksXG4gICAgICAgIG1vdW50ZWQgPSBtb3VudGVkTm9kZXNbZG9tTm9kZUlkXSxcbiAgICAgICAgbW91bnRJZCA9IHVuZGVmaW5lZDtcblxuICAgIGlmIChtb3VudGVkICYmIG1vdW50ZWQudHJlZSkge1xuICAgICAgICBtb3VudElkID0gKyttb3VudGVkLmlkO1xuICAgICAgICB2YXIgcGF0Y2hGbiA9IGZ1bmN0aW9uIHBhdGNoRm4oKSB7XG4gICAgICAgICAgICBpZiAobW91bnRlZE5vZGVzW2RvbU5vZGVJZF0gJiYgbW91bnRlZE5vZGVzW2RvbU5vZGVJZF0uaWQgPT09IG1vdW50SWQpIHtcbiAgICAgICAgICAgICAgICBtb3VudGVkLnRyZWUucGF0Y2godHJlZSk7XG4gICAgICAgICAgICAgICAgbW91bnRlZC50cmVlID0gdHJlZTtcbiAgICAgICAgICAgICAgICBjYWxsQ2IoY2IsIGNiQ3R4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgc3luY01vZGUgPyBwYXRjaEZuKCkgOiAoMCwgX3JhZkJhdGNoMi5kZWZhdWx0KShwYXRjaEZuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBtb3VudGVkTm9kZXNbZG9tTm9kZUlkXSA9IHsgdHJlZTogbnVsbCwgaWQ6IG1vdW50SWQgPSArK2NvdW50ZXIgfTtcblxuICAgICAgICB2YXIgZXhpc3RpbmdEb20gPSBkb21Ob2RlLmZpcnN0RWxlbWVudENoaWxkO1xuICAgICAgICBpZiAoZXhpc3RpbmdEb20pIHtcbiAgICAgICAgICAgIG1vdW50ZWROb2Rlc1tkb21Ob2RlSWRdLnRyZWUgPSB0cmVlO1xuICAgICAgICAgICAgdHJlZS5hZG9wdERvbShleGlzdGluZ0RvbSk7XG4gICAgICAgICAgICB0cmVlLm1vdW50KCk7XG4gICAgICAgICAgICBjYWxsQ2IoY2IsIGNiQ3R4KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciByZW5kZXJGbiA9IGZ1bmN0aW9uIHJlbmRlckZuKCkge1xuICAgICAgICAgICAgICAgIGlmIChtb3VudGVkTm9kZXNbZG9tTm9kZUlkXSAmJiBtb3VudGVkTm9kZXNbZG9tTm9kZUlkXS5pZCA9PT0gbW91bnRJZCkge1xuICAgICAgICAgICAgICAgICAgICBtb3VudGVkTm9kZXNbZG9tTm9kZUlkXS50cmVlID0gdHJlZTtcbiAgICAgICAgICAgICAgICAgICAgZG9tTm9kZS5hcHBlbmRDaGlsZCh0cmVlLnJlbmRlclRvRG9tKCkpO1xuICAgICAgICAgICAgICAgICAgICB0cmVlLm1vdW50KCk7XG4gICAgICAgICAgICAgICAgICAgIGNhbGxDYihjYiwgY2JDdHgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIHN5bmNNb2RlID8gcmVuZGVyRm4oKSA6ICgwLCBfcmFmQmF0Y2gyLmRlZmF1bHQpKHJlbmRlckZuKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuZnVuY3Rpb24gdW5tb3VudChkb21Ob2RlLCBjYiwgY2JDdHgsIHN5bmNNb2RlKSB7XG4gICAgdmFyIGRvbU5vZGVJZCA9ICgwLCBfZ2V0RG9tTm9kZUlkMi5kZWZhdWx0KShkb21Ob2RlKTtcbiAgICB2YXIgbW91bnRlZCA9IG1vdW50ZWROb2Rlc1tkb21Ob2RlSWRdO1xuXG4gICAgaWYgKG1vdW50ZWQpIHtcbiAgICAgICAgKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBtb3VudElkID0gKyttb3VudGVkLmlkLFxuICAgICAgICAgICAgICAgIHVubW91bnRGbiA9IGZ1bmN0aW9uIHVubW91bnRGbigpIHtcbiAgICAgICAgICAgICAgICBtb3VudGVkID0gbW91bnRlZE5vZGVzW2RvbU5vZGVJZF07XG4gICAgICAgICAgICAgICAgaWYgKG1vdW50ZWQgJiYgbW91bnRlZC5pZCA9PT0gbW91bnRJZCkge1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgbW91bnRlZE5vZGVzW2RvbU5vZGVJZF07XG4gICAgICAgICAgICAgICAgICAgIHZhciB0cmVlID0gbW91bnRlZC50cmVlO1xuICAgICAgICAgICAgICAgICAgICBpZiAodHJlZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdmFyIHRyZWVEb21Ob2RlID0gdHJlZS5nZXREb21Ob2RlKCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB0cmVlLnVubW91bnQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGRvbU5vZGUucmVtb3ZlQ2hpbGQodHJlZURvbU5vZGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIGNhbGxDYihjYiwgY2JDdHgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIG1vdW50ZWQudHJlZSA/IHN5bmNNb2RlID8gdW5tb3VudEZuKCkgOiAoMCwgX3JhZkJhdGNoMi5kZWZhdWx0KSh1bm1vdW50Rm4pIDogc3luY01vZGUgfHwgY2FsbENiKGNiLCBjYkN0eCk7XG4gICAgICAgIH0pKCk7XG4gICAgfSBlbHNlIGlmICghc3luY01vZGUpIHtcbiAgICAgICAgY2FsbENiKGNiLCBjYkN0eCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBjYWxsQ2IoY2IsIGNiQ3R4KSB7XG4gICAgY2IgJiYgY2IuY2FsbChjYkN0eCB8fCB0aGlzKTtcbn1cblxuZnVuY3Rpb24gbW91bnRUb0RvbShkb21Ob2RlLCB0cmVlLCBjYiwgY2JDdHgpIHtcbiAgICBtb3VudChkb21Ob2RlLCB0cmVlLCBjYiwgY2JDdHgsIGZhbHNlKTtcbn1cblxuZnVuY3Rpb24gbW91bnRUb0RvbVN5bmMoZG9tTm9kZSwgdHJlZSkge1xuICAgIG1vdW50KGRvbU5vZGUsIHRyZWUsIG51bGwsIG51bGwsIHRydWUpO1xufVxuXG5mdW5jdGlvbiB1bm1vdW50RnJvbURvbShkb21Ob2RlLCBjYiwgY2JDdHgpIHtcbiAgICB1bm1vdW50KGRvbU5vZGUsIGNiLCBjYkN0eCwgZmFsc2UpO1xufVxuXG5mdW5jdGlvbiB1bm1vdW50RnJvbURvbVN5bmMoZG9tTm9kZSkge1xuICAgIHVubW91bnQoZG9tTm9kZSwgbnVsbCwgbnVsbCwgdHJ1ZSk7XG59IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG5cbnZhciBfZG9tQXR0cnMgPSByZXF1aXJlKCcuL2RvbUF0dHJzJyk7XG5cbnZhciBfZG9tQXR0cnMyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZG9tQXR0cnMpO1xuXG52YXIgX2RvbUV2ZW50TWFuYWdlciA9IHJlcXVpcmUoJy4vZXZlbnRzL2RvbUV2ZW50TWFuYWdlcicpO1xuXG52YXIgX2F0dHJzVG9FdmVudHMgPSByZXF1aXJlKCcuL2V2ZW50cy9hdHRyc1RvRXZlbnRzJyk7XG5cbnZhciBfYXR0cnNUb0V2ZW50czIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9hdHRyc1RvRXZlbnRzKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcblxuZnVuY3Rpb24gYXBwZW5kQ2hpbGQocGFyZW50Tm9kZSwgY2hpbGROb2RlKSB7XG4gICAgcGFyZW50Tm9kZS5nZXREb21Ob2RlKCkuYXBwZW5kQ2hpbGQoY2hpbGROb2RlLnJlbmRlclRvRG9tKHBhcmVudE5vZGUpKTtcbiAgICBjaGlsZE5vZGUubW91bnQoKTtcbn1cblxuZnVuY3Rpb24gaW5zZXJ0Q2hpbGQocGFyZW50Tm9kZSwgY2hpbGROb2RlLCBiZWZvcmVDaGlsZE5vZGUpIHtcbiAgICBwYXJlbnROb2RlLmdldERvbU5vZGUoKS5pbnNlcnRCZWZvcmUoY2hpbGROb2RlLnJlbmRlclRvRG9tKHBhcmVudE5vZGUpLCBiZWZvcmVDaGlsZE5vZGUuZ2V0RG9tTm9kZSgpKTtcbiAgICBjaGlsZE5vZGUubW91bnQoKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlQ2hpbGQocGFyZW50Tm9kZSwgY2hpbGROb2RlKSB7XG4gICAgdmFyIGNoaWxkRG9tTm9kZSA9IGNoaWxkTm9kZS5nZXREb21Ob2RlKCk7XG4gICAgY2hpbGROb2RlLnVubW91bnQoKTtcbiAgICBwYXJlbnROb2RlLmdldERvbU5vZGUoKS5yZW1vdmVDaGlsZChjaGlsZERvbU5vZGUpO1xufVxuXG5mdW5jdGlvbiBtb3ZlQ2hpbGQocGFyZW50Tm9kZSwgY2hpbGROb2RlLCB0b0NoaWxkTm9kZSwgYWZ0ZXIpIHtcbiAgICB2YXIgcGFyZW50RG9tTm9kZSA9IHBhcmVudE5vZGUuZ2V0RG9tTm9kZSgpLFxuICAgICAgICBjaGlsZERvbU5vZGUgPSBjaGlsZE5vZGUuZ2V0RG9tTm9kZSgpLFxuICAgICAgICB0b0NoaWxkRG9tTm9kZSA9IHRvQ2hpbGROb2RlLmdldERvbU5vZGUoKSxcbiAgICAgICAgYWN0aXZlRG9tTm9kZSA9IGRvYy5hY3RpdmVFbGVtZW50O1xuXG4gICAgaWYgKGFmdGVyKSB7XG4gICAgICAgIHZhciBuZXh0U2libGluZ0RvbU5vZGUgPSB0b0NoaWxkRG9tTm9kZS5uZXh0U2libGluZztcbiAgICAgICAgbmV4dFNpYmxpbmdEb21Ob2RlID8gcGFyZW50RG9tTm9kZS5pbnNlcnRCZWZvcmUoY2hpbGREb21Ob2RlLCBuZXh0U2libGluZ0RvbU5vZGUpIDogcGFyZW50RG9tTm9kZS5hcHBlbmRDaGlsZChjaGlsZERvbU5vZGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHBhcmVudERvbU5vZGUuaW5zZXJ0QmVmb3JlKGNoaWxkRG9tTm9kZSwgdG9DaGlsZERvbU5vZGUpO1xuICAgIH1cblxuICAgIGlmIChkb2MuYWN0aXZlRWxlbWVudCAhPT0gYWN0aXZlRG9tTm9kZSkge1xuICAgICAgICBhY3RpdmVEb21Ob2RlLmZvY3VzKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmVDaGlsZHJlbihwYXJlbnROb2RlKSB7XG4gICAgdmFyIGNoaWxkTm9kZXMgPSBwYXJlbnROb2RlLl9jaGlsZHJlbixcbiAgICAgICAgbGVuID0gY2hpbGROb2Rlcy5sZW5ndGg7XG5cbiAgICB2YXIgaiA9IDA7XG5cbiAgICB3aGlsZSAoaiA8IGxlbikge1xuICAgICAgICBjaGlsZE5vZGVzW2orK10udW5tb3VudCgpO1xuICAgIH1cblxuICAgIHBhcmVudE5vZGUuZ2V0RG9tTm9kZSgpLmlubmVySFRNTCA9ICcnO1xufVxuXG5mdW5jdGlvbiByZXBsYWNlKHBhcmVudE5vZGUsIG9sZE5vZGUsIG5ld05vZGUpIHtcbiAgICB2YXIgb2xkRG9tTm9kZSA9IG9sZE5vZGUuZ2V0RG9tTm9kZSgpO1xuXG4gICAgb2xkTm9kZS51bm1vdW50KCk7XG4gICAgb2xkRG9tTm9kZS5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdOb2RlLnJlbmRlclRvRG9tKHBhcmVudE5vZGUpLCBvbGREb21Ob2RlKTtcbiAgICBuZXdOb2RlLm1vdW50KCk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUF0dHIobm9kZSwgYXR0ck5hbWUsIGF0dHJWYWwpIHtcbiAgICB2YXIgZG9tTm9kZSA9IG5vZGUuZ2V0RG9tTm9kZSgpO1xuXG4gICAgX2F0dHJzVG9FdmVudHMyLmRlZmF1bHRbYXR0ck5hbWVdID8gKDAsIF9kb21FdmVudE1hbmFnZXIuYWRkTGlzdGVuZXIpKGRvbU5vZGUsIF9hdHRyc1RvRXZlbnRzMi5kZWZhdWx0W2F0dHJOYW1lXSwgYXR0clZhbCkgOiAoMCwgX2RvbUF0dHJzMi5kZWZhdWx0KShhdHRyTmFtZSkuc2V0KGRvbU5vZGUsIGF0dHJOYW1lLCBhdHRyVmFsKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlQXR0cihub2RlLCBhdHRyTmFtZSkge1xuICAgIHZhciBkb21Ob2RlID0gbm9kZS5nZXREb21Ob2RlKCk7XG5cbiAgICBfYXR0cnNUb0V2ZW50czIuZGVmYXVsdFthdHRyTmFtZV0gPyAoMCwgX2RvbUV2ZW50TWFuYWdlci5yZW1vdmVMaXN0ZW5lcikoZG9tTm9kZSwgX2F0dHJzVG9FdmVudHMyLmRlZmF1bHRbYXR0ck5hbWVdKSA6ICgwLCBfZG9tQXR0cnMyLmRlZmF1bHQpKGF0dHJOYW1lKS5yZW1vdmUoZG9tTm9kZSwgYXR0ck5hbWUpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVUZXh0KG5vZGUsIHRleHQsIGVzY2FwZSkge1xuICAgIHZhciBkb21Ob2RlID0gbm9kZS5nZXREb21Ob2RlKCk7XG4gICAgZXNjYXBlID8gZG9tTm9kZS50ZXh0Q29udGVudCA9IHRleHQgOiBkb21Ob2RlLmlubmVySFRNTCA9IHRleHQ7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZVRleHQocGFyZW50Tm9kZSkge1xuICAgIHBhcmVudE5vZGUuZ2V0RG9tTm9kZSgpLmlubmVySFRNTCA9ICcnO1xufVxuXG5leHBvcnRzLmRlZmF1bHQgPSB7XG4gICAgYXBwZW5kQ2hpbGQ6IGFwcGVuZENoaWxkLFxuICAgIGluc2VydENoaWxkOiBpbnNlcnRDaGlsZCxcbiAgICByZW1vdmVDaGlsZDogcmVtb3ZlQ2hpbGQsXG4gICAgbW92ZUNoaWxkOiBtb3ZlQ2hpbGQsXG4gICAgcmVtb3ZlQ2hpbGRyZW46IHJlbW92ZUNoaWxkcmVuLFxuICAgIHJlcGxhY2U6IHJlcGxhY2UsXG4gICAgdXBkYXRlQXR0cjogdXBkYXRlQXR0cixcbiAgICByZW1vdmVBdHRyOiByZW1vdmVBdHRyLFxuICAgIHVwZGF0ZVRleHQ6IHVwZGF0ZVRleHQsXG4gICAgcmVtb3ZlVGV4dDogcmVtb3ZlVGV4dFxufTsiLCJcInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xudmFyIHJhZiA9IGdsb2JhbC5yZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgZ2xvYmFsLndlYmtpdFJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCBnbG9iYWwubW96UmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHNldFRpbWVvdXQoY2FsbGJhY2ssIDEwMDAgLyA2MCk7XG59O1xuXG52YXIgYmF0Y2ggPSBbXTtcblxuZnVuY3Rpb24gYXBwbHlCYXRjaCgpIHtcbiAgICB2YXIgaSA9IDA7XG5cbiAgICB3aGlsZSAoaSA8IGJhdGNoLmxlbmd0aCkge1xuICAgICAgICBiYXRjaFtpKytdKCk7XG4gICAgfVxuXG4gICAgYmF0Y2ggPSBbXTtcbn1cblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKGZuKSB7XG4gICAgYmF0Y2gucHVzaChmbikgPT09IDEgJiYgcmFmKGFwcGx5QmF0Y2gpO1xufTtcblxuZXhwb3J0cy5hcHBseUJhdGNoID0gYXBwbHlCYXRjaDsiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQsXG4gICAgZWxlbWVudFByb3RvcyA9IHt9O1xuXG5mdW5jdGlvbiBjcmVhdGVFbGVtZW50KG5zLCB0YWcpIHtcbiAgICB2YXIgYmFzZUVsZW1lbnQgPSB1bmRlZmluZWQ7XG4gICAgaWYgKG5zKSB7XG4gICAgICAgIHZhciBrZXkgPSBucyArICc6JyArIHRhZztcbiAgICAgICAgYmFzZUVsZW1lbnQgPSBlbGVtZW50UHJvdG9zW2tleV0gfHwgKGVsZW1lbnRQcm90b3Nba2V5XSA9IGRvYy5jcmVhdGVFbGVtZW50TlMobnMsIHRhZykpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGJhc2VFbGVtZW50ID0gZWxlbWVudFByb3Rvc1t0YWddIHx8IChlbGVtZW50UHJvdG9zW3RhZ10gPSBkb2MuY3JlYXRlRWxlbWVudCh0YWcpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gYmFzZUVsZW1lbnQuY2xvbmVOb2RlKCk7XG59XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGNyZWF0ZUVsZW1lbnQ7IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50LFxuICAgIFRPUF9MRVZFTF9OU19UQUdTID0ge1xuICAgICdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc6ICdzdmcnLFxuICAgICdodHRwOi8vd3d3LnczLm9yZy8xOTk4L01hdGgvTWF0aE1MJzogJ21hdGgnXG59O1xuXG52YXIgaGVscGVyRG9tTm9kZSA9IHVuZGVmaW5lZDtcblxuZnVuY3Rpb24gY3JlYXRlRWxlbWVudEJ5SHRtbChodG1sLCB0YWcsIG5zKSB7XG4gICAgaGVscGVyRG9tTm9kZSB8fCAoaGVscGVyRG9tTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKTtcblxuICAgIGlmICghbnMgfHwgIVRPUF9MRVZFTF9OU19UQUdTW25zXSB8fCBUT1BfTEVWRUxfTlNfVEFHU1tuc10gPT09IHRhZykge1xuICAgICAgICBoZWxwZXJEb21Ob2RlLmlubmVySFRNTCA9IGh0bWw7XG4gICAgICAgIHJldHVybiBoZWxwZXJEb21Ob2RlLnJlbW92ZUNoaWxkKGhlbHBlckRvbU5vZGUuZmlyc3RDaGlsZCk7XG4gICAgfVxuXG4gICAgdmFyIHRvcExldmVsVGFnID0gVE9QX0xFVkVMX05TX1RBR1NbbnNdO1xuICAgIGhlbHBlckRvbU5vZGUuaW5uZXJIVE1MID0gJzwnICsgdG9wTGV2ZWxUYWcgKyAnIHhtbG5zPVwiJyArIG5zICsgJ1wiPicgKyBodG1sICsgJzwvJyArIHRvcExldmVsVGFnICsgJz4nO1xuICAgIHJldHVybiBoZWxwZXJEb21Ob2RlLnJlbW92ZUNoaWxkKGhlbHBlckRvbU5vZGUuZmlyc3RDaGlsZCkuZmlyc3RDaGlsZDtcbn1cblxuZXhwb3J0cy5kZWZhdWx0ID0gY3JlYXRlRWxlbWVudEJ5SHRtbDsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBfZXh0ZW5kcyA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gKHRhcmdldCkgeyBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykgeyB2YXIgc291cmNlID0gYXJndW1lbnRzW2ldOyBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7IGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoc291cmNlLCBrZXkpKSB7IHRhcmdldFtrZXldID0gc291cmNlW2tleV07IH0gfSB9IHJldHVybiB0YXJnZXQ7IH07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcblxudmFyIF9jcmVhdGVDb21wb25lbnQgPSByZXF1aXJlKCcuLi9jcmVhdGVDb21wb25lbnQnKTtcblxudmFyIF9jcmVhdGVDb21wb25lbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY3JlYXRlQ29tcG9uZW50KTtcblxudmFyIF9UYWdOb2RlID0gcmVxdWlyZSgnLi4vbm9kZXMvVGFnTm9kZScpO1xuXG52YXIgX1RhZ05vZGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfVGFnTm9kZSk7XG5cbnZhciBfcmFmQmF0Y2ggPSByZXF1aXJlKCcuLi9jbGllbnQvcmFmQmF0Y2gnKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuZXhwb3J0cy5kZWZhdWx0ID0gKDAsIF9jcmVhdGVDb21wb25lbnQyLmRlZmF1bHQpKHtcbiAgICBvbkluaXQ6IGZ1bmN0aW9uIG9uSW5pdCgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgICAgICB0aGlzLm9uSW5wdXQgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgdmFyIGF0dHJzID0gX3RoaXMuZ2V0QXR0cnMoKTtcblxuICAgICAgICAgICAgYXR0cnMub25JbnB1dCAmJiBhdHRycy5vbklucHV0KGUpO1xuICAgICAgICAgICAgYXR0cnMub25DaGFuZ2UgJiYgYXR0cnMub25DaGFuZ2UoZSk7XG5cbiAgICAgICAgICAgICgwLCBfcmFmQmF0Y2guYXBwbHlCYXRjaCkoKTtcblxuICAgICAgICAgICAgaWYgKF90aGlzLmlzTW91bnRlZCgpKSB7XG4gICAgICAgICAgICAgICAgLy8gYXR0cnMgY291bGQgYmUgY2hhbmdlZCBkdXJpbmcgYXBwbHlCYXRjaCgpXG4gICAgICAgICAgICAgICAgYXR0cnMgPSBfdGhpcy5nZXRBdHRycygpO1xuICAgICAgICAgICAgICAgIHZhciBjb250cm9sID0gX3RoaXMuZ2V0RG9tUmVmKCdjb250cm9sJyk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhdHRycy52YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY29udHJvbC52YWx1ZSAhPT0gYXR0cnMudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udHJvbC52YWx1ZSA9IGF0dHJzLnZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLm9uQ2xpY2sgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgdmFyIGF0dHJzID0gX3RoaXMuZ2V0QXR0cnMoKTtcblxuICAgICAgICAgICAgYXR0cnMub25DbGljayAmJiBhdHRycy5vbkNsaWNrKGUpO1xuICAgICAgICAgICAgYXR0cnMub25DaGFuZ2UgJiYgYXR0cnMub25DaGFuZ2UoZSk7XG5cbiAgICAgICAgICAgICgwLCBfcmFmQmF0Y2guYXBwbHlCYXRjaCkoKTtcblxuICAgICAgICAgICAgaWYgKF90aGlzLmlzTW91bnRlZCgpKSB7XG4gICAgICAgICAgICAgICAgLy8gYXR0cnMgY291bGQgYmUgY2hhbmdlZCBkdXJpbmcgYXBwbHlCYXRjaCgpXG4gICAgICAgICAgICAgICAgYXR0cnMgPSBfdGhpcy5nZXRBdHRycygpO1xuICAgICAgICAgICAgICAgIHZhciBjb250cm9sID0gX3RoaXMuZ2V0RG9tUmVmKCdjb250cm9sJyk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhdHRycy5jaGVja2VkICE9PSAndW5kZWZpbmVkJyAmJiBjb250cm9sLmNoZWNrZWQgIT09IGF0dHJzLmNoZWNrZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udHJvbC5jaGVja2VkID0gYXR0cnMuY2hlY2tlZDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfSxcbiAgICBvblJlbmRlcjogZnVuY3Rpb24gb25SZW5kZXIoYXR0cnMpIHtcbiAgICAgICAgdmFyIGNvbnRyb2xBdHRycyA9IHVuZGVmaW5lZDtcblxuICAgICAgICBpZiAoYXR0cnMudHlwZSA9PT0gJ2ZpbGUnKSB7XG4gICAgICAgICAgICBjb250cm9sQXR0cnMgPSBhdHRycztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGNvbnRyb2xBdHRycyA9IF9leHRlbmRzKHt9LCBhdHRycywgeyBvbkNoYW5nZTogbnVsbCB9KTtcblxuICAgICAgICAgICAgaWYgKGF0dHJzLnR5cGUgPT09ICdjaGVja2JveCcgfHwgYXR0cnMudHlwZSA9PT0gJ3JhZGlvJykge1xuICAgICAgICAgICAgICAgIGNvbnRyb2xBdHRycy5vbkNsaWNrID0gdGhpcy5vbkNsaWNrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBjb250cm9sQXR0cnMub25JbnB1dCA9IHRoaXMub25JbnB1dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLnNldERvbVJlZignY29udHJvbCcsIG5ldyBfVGFnTm9kZTIuZGVmYXVsdCgnaW5wdXQnKS5hdHRycyhjb250cm9sQXR0cnMpKTtcbiAgICB9XG59KTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBfZXh0ZW5kcyA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gKHRhcmdldCkgeyBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykgeyB2YXIgc291cmNlID0gYXJndW1lbnRzW2ldOyBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7IGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoc291cmNlLCBrZXkpKSB7IHRhcmdldFtrZXldID0gc291cmNlW2tleV07IH0gfSB9IHJldHVybiB0YXJnZXQ7IH07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcblxudmFyIF9jcmVhdGVDb21wb25lbnQgPSByZXF1aXJlKCcuLi9jcmVhdGVDb21wb25lbnQnKTtcblxudmFyIF9jcmVhdGVDb21wb25lbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY3JlYXRlQ29tcG9uZW50KTtcblxudmFyIF9UYWdOb2RlID0gcmVxdWlyZSgnLi4vbm9kZXMvVGFnTm9kZScpO1xuXG52YXIgX1RhZ05vZGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfVGFnTm9kZSk7XG5cbnZhciBfcmFmQmF0Y2ggPSByZXF1aXJlKCcuLi9jbGllbnQvcmFmQmF0Y2gnKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuZXhwb3J0cy5kZWZhdWx0ID0gKDAsIF9jcmVhdGVDb21wb25lbnQyLmRlZmF1bHQpKHtcbiAgICBvbkluaXQ6IGZ1bmN0aW9uIG9uSW5pdCgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgICAgICB0aGlzLm9uQ2hhbmdlID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIHZhciBhdHRycyA9IF90aGlzLmdldEF0dHJzKCk7XG5cbiAgICAgICAgICAgIGF0dHJzLm9uQ2hhbmdlICYmIGF0dHJzLm9uQ2hhbmdlKGUpO1xuXG4gICAgICAgICAgICAoMCwgX3JhZkJhdGNoLmFwcGx5QmF0Y2gpKCk7XG5cbiAgICAgICAgICAgIGlmIChfdGhpcy5pc01vdW50ZWQoKSkge1xuICAgICAgICAgICAgICAgIC8vIGF0dHJzIGNvdWxkIGJlIGNoYW5nZWQgZHVyaW5nIGFwcGx5QmF0Y2goKVxuICAgICAgICAgICAgICAgIGF0dHJzID0gX3RoaXMuZ2V0QXR0cnMoKTtcbiAgICAgICAgICAgICAgICB2YXIgY29udHJvbCA9IF90aGlzLmdldERvbVJlZignY29udHJvbCcpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYXR0cnMudmFsdWUgIT09ICd1bmRlZmluZWQnICYmIGNvbnRyb2wudmFsdWUgIT09IGF0dHJzLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRyb2wudmFsdWUgPSBhdHRycy52YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfSxcbiAgICBvblJlbmRlcjogZnVuY3Rpb24gb25SZW5kZXIoYXR0cnMsIGNoaWxkcmVuKSB7XG4gICAgICAgIHZhciBjb250cm9sQXR0cnMgPSBfZXh0ZW5kcyh7fSwgYXR0cnMsIHtcbiAgICAgICAgICAgIG9uQ2hhbmdlOiB0aGlzLm9uQ2hhbmdlXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB0aGlzLnNldERvbVJlZignY29udHJvbCcsIG5ldyBfVGFnTm9kZTIuZGVmYXVsdCgnc2VsZWN0JykuYXR0cnMoY29udHJvbEF0dHJzKS5jaGlsZHJlbihjaGlsZHJlbikpO1xuICAgIH1cbn0pOyIsIid1c2Ugc3RyaWN0JztcblxudmFyIF9leHRlbmRzID0gT2JqZWN0LmFzc2lnbiB8fCBmdW5jdGlvbiAodGFyZ2V0KSB7IGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7IHZhciBzb3VyY2UgPSBhcmd1bWVudHNbaV07IGZvciAodmFyIGtleSBpbiBzb3VyY2UpIHsgaWYgKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChzb3VyY2UsIGtleSkpIHsgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XTsgfSB9IH0gcmV0dXJuIHRhcmdldDsgfTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX2NyZWF0ZUNvbXBvbmVudCA9IHJlcXVpcmUoJy4uL2NyZWF0ZUNvbXBvbmVudCcpO1xuXG52YXIgX2NyZWF0ZUNvbXBvbmVudDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jcmVhdGVDb21wb25lbnQpO1xuXG52YXIgX1RhZ05vZGUgPSByZXF1aXJlKCcuLi9ub2Rlcy9UYWdOb2RlJyk7XG5cbnZhciBfVGFnTm9kZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9UYWdOb2RlKTtcblxudmFyIF9yYWZCYXRjaCA9IHJlcXVpcmUoJy4uL2NsaWVudC9yYWZCYXRjaCcpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG5leHBvcnRzLmRlZmF1bHQgPSAoMCwgX2NyZWF0ZUNvbXBvbmVudDIuZGVmYXVsdCkoe1xuICAgIG9uSW5pdDogZnVuY3Rpb24gb25Jbml0KCkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgICAgIHRoaXMub25JbnB1dCA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICB2YXIgYXR0cnMgPSBfdGhpcy5nZXRBdHRycygpO1xuXG4gICAgICAgICAgICBhdHRycy5vbklucHV0ICYmIGF0dHJzLm9uSW5wdXQoZSk7XG4gICAgICAgICAgICBhdHRycy5vbkNoYW5nZSAmJiBhdHRycy5vbkNoYW5nZShlKTtcblxuICAgICAgICAgICAgKDAsIF9yYWZCYXRjaC5hcHBseUJhdGNoKSgpO1xuXG4gICAgICAgICAgICBpZiAoX3RoaXMuaXNNb3VudGVkKCkpIHtcbiAgICAgICAgICAgICAgICAvLyBhdHRycyBjb3VsZCBiZSBjaGFuZ2VkIGR1cmluZyBhcHBseUJhdGNoKClcbiAgICAgICAgICAgICAgICBhdHRycyA9IF90aGlzLmdldEF0dHJzKCk7XG4gICAgICAgICAgICAgICAgdmFyIGNvbnRyb2wgPSBfdGhpcy5nZXREb21SZWYoJ2NvbnRyb2wnKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGF0dHJzLnZhbHVlICE9PSAndW5kZWZpbmVkJyAmJiBjb250cm9sLnZhbHVlICE9PSBhdHRycy52YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb250cm9sLnZhbHVlID0gYXR0cnMudmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgb25SZW5kZXI6IGZ1bmN0aW9uIG9uUmVuZGVyKGF0dHJzKSB7XG4gICAgICAgIHZhciBjb250cm9sQXR0cnMgPSBfZXh0ZW5kcyh7fSwgYXR0cnMsIHtcbiAgICAgICAgICAgIG9uSW5wdXQ6IHRoaXMub25JbnB1dCxcbiAgICAgICAgICAgIG9uQ2hhbmdlOiBudWxsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB0aGlzLnNldERvbVJlZignY29udHJvbCcsIG5ldyBfVGFnTm9kZTIuZGVmYXVsdCgndGV4dGFyZWEnKS5hdHRycyhjb250cm9sQXR0cnMpKTtcbiAgICB9XG59KTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBfZXh0ZW5kcyA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gKHRhcmdldCkgeyBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykgeyB2YXIgc291cmNlID0gYXJndW1lbnRzW2ldOyBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7IGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoc291cmNlLCBrZXkpKSB7IHRhcmdldFtrZXldID0gc291cmNlW2tleV07IH0gfSB9IHJldHVybiB0YXJnZXQ7IH07XG5cbnZhciBfdHlwZW9mID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBTeW1ib2wuaXRlcmF0b3IgPT09IFwic3ltYm9sXCIgPyBmdW5jdGlvbiAob2JqKSB7IHJldHVybiB0eXBlb2Ygb2JqOyB9IDogZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gb2JqICYmIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvYmouY29uc3RydWN0b3IgPT09IFN5bWJvbCA/IFwic3ltYm9sXCIgOiB0eXBlb2Ygb2JqOyB9O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG5cbnZhciBfbm9PcCA9IHJlcXVpcmUoJy4vdXRpbHMvbm9PcCcpO1xuXG52YXIgX25vT3AyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfbm9PcCk7XG5cbnZhciBfcmFmQmF0Y2ggPSByZXF1aXJlKCcuL2NsaWVudC9yYWZCYXRjaCcpO1xuXG52YXIgX3JhZkJhdGNoMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3JhZkJhdGNoKTtcblxudmFyIF9jcmVhdGVOb2RlID0gcmVxdWlyZSgnLi9jcmVhdGVOb2RlJyk7XG5cbnZhciBfY3JlYXRlTm9kZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jcmVhdGVOb2RlKTtcblxudmFyIF9jb25zb2xlID0gcmVxdWlyZSgnLi91dGlscy9jb25zb2xlJyk7XG5cbnZhciBfY29uc29sZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jb25zb2xlKTtcblxudmFyIF9lbXB0eU9iaiA9IHJlcXVpcmUoJy4vdXRpbHMvZW1wdHlPYmonKTtcblxudmFyIF9lbXB0eU9iajIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9lbXB0eU9iaik7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbmZ1bmN0aW9uIG1vdW50Q29tcG9uZW50KCkge1xuICAgIHRoaXMuX2lzTW91bnRlZCA9IHRydWU7XG4gICAgdGhpcy5vbk1vdW50KHRoaXMuX2F0dHJzKTtcbn1cblxuZnVuY3Rpb24gdW5tb3VudENvbXBvbmVudCgpIHtcbiAgICB0aGlzLl9pc01vdW50ZWQgPSBmYWxzZTtcbiAgICB0aGlzLl9kb21SZWZzID0gbnVsbDtcbiAgICB0aGlzLm9uVW5tb3VudCgpO1xufVxuXG5mdW5jdGlvbiBwYXRjaENvbXBvbmVudChhdHRycywgY2hpbGRyZW4sIGN0eCwgcGFyZW50Tm9kZSkge1xuICAgIGF0dHJzID0gdGhpcy5fYnVpbGRBdHRycyhhdHRycyk7XG5cbiAgICB2YXIgcHJldlJvb3ROb2RlID0gdGhpcy5fcm9vdE5vZGUsXG4gICAgICAgIHByZXZBdHRycyA9IHRoaXMuX2F0dHJzO1xuXG4gICAgaWYgKHByZXZBdHRycyAhPT0gYXR0cnMpIHtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSBhdHRycztcbiAgICAgICAgaWYgKHRoaXMuaXNNb3VudGVkKCkpIHtcbiAgICAgICAgICAgIHZhciBpc1VwZGF0aW5nID0gdGhpcy5faXNVcGRhdGluZztcbiAgICAgICAgICAgIHRoaXMuX2lzVXBkYXRpbmcgPSB0cnVlO1xuICAgICAgICAgICAgdGhpcy5vbkF0dHJzUmVjZWl2ZShhdHRycywgcHJldkF0dHJzKTtcbiAgICAgICAgICAgIHRoaXMuX2lzVXBkYXRpbmcgPSBpc1VwZGF0aW5nO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdGhpcy5fY2hpbGRyZW4gPSBjaGlsZHJlbjtcbiAgICB0aGlzLl9jdHggPSBjdHg7XG5cbiAgICBpZiAodGhpcy5faXNVcGRhdGluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHNob3VsZFVwZGF0ZSA9IHRoaXMuc2hvdWxkVXBkYXRlKGF0dHJzLCBwcmV2QXR0cnMpO1xuXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgdmFyIHNob3VsZFVwZGF0ZVJlc1R5cGUgPSB0eXBlb2Ygc2hvdWxkVXBkYXRlID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihzaG91bGRVcGRhdGUpO1xuICAgICAgICBpZiAoc2hvdWxkVXBkYXRlUmVzVHlwZSAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgICAgICBfY29uc29sZTIuZGVmYXVsdC53YXJuKCdDb21wb25lbnQjc2hvdWxkVXBkYXRlKCkgc2hvdWxkIHJldHVybiBib29sZWFuIGluc3RlYWQgb2YgJyArIHNob3VsZFVwZGF0ZVJlc1R5cGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNob3VsZFVwZGF0ZSkge1xuICAgICAgICB0aGlzLl9yb290Tm9kZSA9IHRoaXMucmVuZGVyKCk7XG4gICAgICAgIHByZXZSb290Tm9kZS5wYXRjaCh0aGlzLl9yb290Tm9kZSwgcGFyZW50Tm9kZSk7XG4gICAgICAgIHRoaXMuaXNNb3VudGVkKCkgJiYgdGhpcy5vblVwZGF0ZShhdHRycywgcHJldkF0dHJzKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNob3VsZENvbXBvbmVudFVwZGF0ZShhdHRycywgcHJldkF0dHJzKSB7XG4gICAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckNvbXBvbmVudFRvRG9tKHBhcmVudE5vZGUpIHtcbiAgICByZXR1cm4gdGhpcy5fcm9vdE5vZGUucmVuZGVyVG9Eb20ocGFyZW50Tm9kZSk7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckNvbXBvbmVudFRvU3RyaW5nKCkge1xuICAgIHJldHVybiB0aGlzLl9yb290Tm9kZS5yZW5kZXJUb1N0cmluZygpO1xufVxuXG5mdW5jdGlvbiBhZG9wdENvbXBvbmVudERvbShkb21Ob2RlLCBwYXJlbnROb2RlKSB7XG4gICAgdGhpcy5fcm9vdE5vZGUuYWRvcHREb20oZG9tTm9kZSwgcGFyZW50Tm9kZSk7XG59XG5cbmZ1bmN0aW9uIGdldENvbXBvbmVudERvbU5vZGUoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3Jvb3ROb2RlLmdldERvbU5vZGUoKTtcbn1cblxuZnVuY3Rpb24gZ2V0Q29tcG9uZW50QXR0cnMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2F0dHJzO1xufVxuXG5mdW5jdGlvbiByZXF1ZXN0Q2hpbGRDb250ZXh0KCkge1xuICAgIHJldHVybiBfZW1wdHlPYmoyLmRlZmF1bHQ7XG59XG5cbmZ1bmN0aW9uIHJlbmRlckNvbXBvbmVudCgpIHtcbiAgICB0aGlzLl9kb21SZWZzID0ge307XG5cbiAgICB2YXIgcm9vdE5vZGUgPSB0aGlzLm9uUmVuZGVyKHRoaXMuX2F0dHJzLCB0aGlzLl9jaGlsZHJlbikgfHwgKDAsIF9jcmVhdGVOb2RlMi5kZWZhdWx0KSgnbm9zY3JpcHQnKTtcblxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIGlmICgodHlwZW9mIHJvb3ROb2RlID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihyb290Tm9kZSkpICE9PSAnb2JqZWN0JyB8fCBBcnJheS5pc0FycmF5KHJvb3ROb2RlKSkge1xuICAgICAgICAgICAgX2NvbnNvbGUyLmRlZmF1bHQuZXJyb3IoJ0NvbXBvbmVudCNvblJlbmRlciBtdXN0IHJldHVybiBhIHNpbmdsZSBub2RlIG9iamVjdCBvbiB0aGUgdG9wIGxldmVsJyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgY2hpbGRDdHggPSB0aGlzLm9uQ2hpbGRDb250ZXh0UmVxdWVzdCh0aGlzLl9hdHRycyk7XG5cbiAgICByb290Tm9kZS5jdHgoY2hpbGRDdHggPT09IF9lbXB0eU9iajIuZGVmYXVsdCA/IHRoaXMuX2N0eCA6IHRoaXMuX2N0eCA9PT0gX2VtcHR5T2JqMi5kZWZhdWx0ID8gY2hpbGRDdHggOiBfZXh0ZW5kcyh7fSwgdGhpcy5fY3R4LCBjaGlsZEN0eCkpO1xuXG4gICAgcmV0dXJuIHJvb3ROb2RlO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVDb21wb25lbnQoY2IsIGNiQ3R4KSB7XG4gICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgIGlmICh0aGlzLl9pc1VwZGF0aW5nKSB7XG4gICAgICAgIGNiICYmICgwLCBfcmFmQmF0Y2gyLmRlZmF1bHQpKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBjYi5jYWxsKGNiQ3R4IHx8IF90aGlzKTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5faXNVcGRhdGluZyA9IHRydWU7XG4gICAgICAgICgwLCBfcmFmQmF0Y2gyLmRlZmF1bHQpKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChfdGhpcy5pc01vdW50ZWQoKSkge1xuICAgICAgICAgICAgICAgIF90aGlzLl9pc1VwZGF0aW5nID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgX3RoaXMucGF0Y2goX3RoaXMuX2F0dHJzLCBfdGhpcy5fY2hpbGRyZW4pO1xuICAgICAgICAgICAgICAgIGNiICYmIGNiLmNhbGwoY2JDdHggfHwgX3RoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGdldENvbXBvbmVudFJvb3ROb2RlKCkge1xuICAgIHJldHVybiB0aGlzLl9yb290Tm9kZTtcbn1cblxuZnVuY3Rpb24gaXNDb21wb25lbnRNb3VudGVkKCkge1xuICAgIHJldHVybiB0aGlzLl9pc01vdW50ZWQ7XG59XG5cbmZ1bmN0aW9uIHNldENvbXBvbmVudERvbVJlZihyZWYsIG5vZGUpIHtcbiAgICByZXR1cm4gdGhpcy5fZG9tUmVmc1tyZWZdID0gbm9kZTtcbn1cblxuZnVuY3Rpb24gZ2V0Q29tcG9uZW50RG9tUmVmKHJlZikge1xuICAgIHJldHVybiB0aGlzLl9kb21SZWZzW3JlZl0gPyB0aGlzLl9kb21SZWZzW3JlZl0uZ2V0RG9tTm9kZSgpIDogbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0Q29tcG9uZW50Q29udGV4dCgpIHtcbiAgICByZXR1cm4gdGhpcy5fY3R4O1xufVxuXG5mdW5jdGlvbiBnZXRDb21wb25lbnREZWZhdWx0QXR0cnMoKSB7XG4gICAgcmV0dXJuIF9lbXB0eU9iajIuZGVmYXVsdDtcbn1cblxuZnVuY3Rpb24gYnVpbGRDb21wb25lbnRBdHRycyhhdHRycykge1xuICAgIGlmICh0aGlzLl9hdHRycyAmJiBhdHRycyA9PT0gdGhpcy5fYXR0cnMpIHtcbiAgICAgICAgcmV0dXJuIGF0dHJzO1xuICAgIH1cblxuICAgIHZhciBjb25zID0gdGhpcy5jb25zdHJ1Y3RvcixcbiAgICAgICAgZGVmYXVsdEF0dHJzID0gY29ucy5fZGVmYXVsdEF0dHJzIHx8IChjb25zLl9kZWZhdWx0QXR0cnMgPSBjb25zLmdldERlZmF1bHRBdHRycygpKTtcblxuICAgIGlmICghYXR0cnMpIHtcbiAgICAgICAgcmV0dXJuIGRlZmF1bHRBdHRycztcbiAgICB9XG5cbiAgICBpZiAoZGVmYXVsdEF0dHJzID09PSBfZW1wdHlPYmoyLmRlZmF1bHQpIHtcbiAgICAgICAgcmV0dXJuIGF0dHJzO1xuICAgIH1cblxuICAgIHZhciByZXMgPSB7fTtcblxuICAgIGZvciAodmFyIGkgaW4gZGVmYXVsdEF0dHJzKSB7XG4gICAgICAgIHJlc1tpXSA9IGRlZmF1bHRBdHRyc1tpXTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpIGluIGF0dHJzKSB7XG4gICAgICAgIHJlc1tpXSA9IGF0dHJzW2ldO1xuICAgIH1cblxuICAgIHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbXBvbmVudChwcm9wcywgc3RhdGljUHJvcHMpIHtcbiAgICB2YXIgcmVzID0gZnVuY3Rpb24gcmVzKGF0dHJzLCBjaGlsZHJlbiwgY3R4KSB7XG4gICAgICAgIHRoaXMuX2F0dHJzID0gdGhpcy5fYnVpbGRBdHRycyhhdHRycyk7XG4gICAgICAgIHRoaXMuX2NoaWxkcmVuID0gY2hpbGRyZW47XG4gICAgICAgIHRoaXMuX2N0eCA9IGN0eDtcbiAgICAgICAgdGhpcy5fZG9tUmVmcyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2lzTW91bnRlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9pc1VwZGF0aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMub25Jbml0KHRoaXMuX2F0dHJzKTtcbiAgICAgICAgdGhpcy5fcm9vdE5vZGUgPSB0aGlzLnJlbmRlcigpO1xuICAgIH0sXG4gICAgICAgIHB0cCA9IHtcbiAgICAgICAgY29uc3RydWN0b3I6IHJlcyxcbiAgICAgICAgb25Jbml0OiBfbm9PcDIuZGVmYXVsdCxcbiAgICAgICAgbW91bnQ6IG1vdW50Q29tcG9uZW50LFxuICAgICAgICB1bm1vdW50OiB1bm1vdW50Q29tcG9uZW50LFxuICAgICAgICBvbk1vdW50OiBfbm9PcDIuZGVmYXVsdCxcbiAgICAgICAgb25Vbm1vdW50OiBfbm9PcDIuZGVmYXVsdCxcbiAgICAgICAgb25BdHRyc1JlY2VpdmU6IF9ub09wMi5kZWZhdWx0LFxuICAgICAgICBzaG91bGRVcGRhdGU6IHNob3VsZENvbXBvbmVudFVwZGF0ZSxcbiAgICAgICAgb25VcGRhdGU6IF9ub09wMi5kZWZhdWx0LFxuICAgICAgICBpc01vdW50ZWQ6IGlzQ29tcG9uZW50TW91bnRlZCxcbiAgICAgICAgcmVuZGVyVG9Eb206IHJlbmRlckNvbXBvbmVudFRvRG9tLFxuICAgICAgICByZW5kZXJUb1N0cmluZzogcmVuZGVyQ29tcG9uZW50VG9TdHJpbmcsXG4gICAgICAgIGFkb3B0RG9tOiBhZG9wdENvbXBvbmVudERvbSxcbiAgICAgICAgZ2V0RG9tTm9kZTogZ2V0Q29tcG9uZW50RG9tTm9kZSxcbiAgICAgICAgZ2V0Um9vdE5vZGU6IGdldENvbXBvbmVudFJvb3ROb2RlLFxuICAgICAgICByZW5kZXI6IHJlbmRlckNvbXBvbmVudCxcbiAgICAgICAgb25SZW5kZXI6IF9ub09wMi5kZWZhdWx0LFxuICAgICAgICB1cGRhdGU6IHVwZGF0ZUNvbXBvbmVudCxcbiAgICAgICAgcGF0Y2g6IHBhdGNoQ29tcG9uZW50LFxuICAgICAgICBnZXREb21SZWY6IGdldENvbXBvbmVudERvbVJlZixcbiAgICAgICAgc2V0RG9tUmVmOiBzZXRDb21wb25lbnREb21SZWYsXG4gICAgICAgIGdldEF0dHJzOiBnZXRDb21wb25lbnRBdHRycyxcbiAgICAgICAgb25DaGlsZENvbnRleHRSZXF1ZXN0OiByZXF1ZXN0Q2hpbGRDb250ZXh0LFxuICAgICAgICBnZXRDb250ZXh0OiBnZXRDb21wb25lbnRDb250ZXh0LFxuICAgICAgICBfYnVpbGRBdHRyczogYnVpbGRDb21wb25lbnRBdHRyc1xuICAgIH07XG5cbiAgICBmb3IgKHZhciBpIGluIHByb3BzKSB7XG4gICAgICAgIHB0cFtpXSA9IHByb3BzW2ldO1xuICAgIH1cblxuICAgIHJlcy5wcm90b3R5cGUgPSBwdHA7XG5cbiAgICByZXMuZ2V0RGVmYXVsdEF0dHJzID0gZ2V0Q29tcG9uZW50RGVmYXVsdEF0dHJzO1xuXG4gICAgZm9yICh2YXIgaSBpbiBzdGF0aWNQcm9wcykge1xuICAgICAgICByZXNbaV0gPSBzdGF0aWNQcm9wc1tpXTtcbiAgICB9XG5cbiAgICByZXMuX192aWRvbV9fY29tcG9uZW50X18gPSB0cnVlO1xuXG4gICAgcmV0dXJuIHJlcztcbn1cblxuZXhwb3J0cy5kZWZhdWx0ID0gY3JlYXRlQ29tcG9uZW50OyIsIid1c2Ugc3RyaWN0JztcblxudmFyIF90eXBlb2YgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIFN5bWJvbC5pdGVyYXRvciA9PT0gXCJzeW1ib2xcIiA/IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIHR5cGVvZiBvYmo7IH0gOiBmdW5jdGlvbiAob2JqKSB7IHJldHVybiBvYmogJiYgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9iai5jb25zdHJ1Y3RvciA9PT0gU3ltYm9sID8gXCJzeW1ib2xcIiA6IHR5cGVvZiBvYmo7IH07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgICBzd2l0Y2ggKHR5cGVvZiB0eXBlID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZih0eXBlKSkge1xuICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgcmV0dXJuIFdSQVBQRVJfQ09NUE9ORU5UU1t0eXBlXSA/IG5ldyBfQ29tcG9uZW50Tm9kZTIuZGVmYXVsdChXUkFQUEVSX0NPTVBPTkVOVFNbdHlwZV0pIDogbmV3IF9UYWdOb2RlMi5kZWZhdWx0KHR5cGUpO1xuXG4gICAgICAgIGNhc2UgJ2Z1bmN0aW9uJzpcbiAgICAgICAgICAgIHJldHVybiB0eXBlLl9fdmlkb21fX2NvbXBvbmVudF9fID8gbmV3IF9Db21wb25lbnROb2RlMi5kZWZhdWx0KHR5cGUpIDogbmV3IF9GdW5jdGlvbkNvbXBvbmVudE5vZGUyLmRlZmF1bHQodHlwZSk7XG5cbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgX2NvbnNvbGUyLmRlZmF1bHQuZXJyb3IoJ1Vuc3VwcG9ydGVkIHR5cGUgb2Ygbm9kZScpO1xuICAgICAgICAgICAgfVxuICAgIH1cbn07XG5cbnZhciBfVGFnTm9kZSA9IHJlcXVpcmUoJy4vbm9kZXMvVGFnTm9kZScpO1xuXG52YXIgX1RhZ05vZGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfVGFnTm9kZSk7XG5cbnZhciBfQ29tcG9uZW50Tm9kZSA9IHJlcXVpcmUoJy4vbm9kZXMvQ29tcG9uZW50Tm9kZScpO1xuXG52YXIgX0NvbXBvbmVudE5vZGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfQ29tcG9uZW50Tm9kZSk7XG5cbnZhciBfRnVuY3Rpb25Db21wb25lbnROb2RlID0gcmVxdWlyZSgnLi9ub2Rlcy9GdW5jdGlvbkNvbXBvbmVudE5vZGUnKTtcblxudmFyIF9GdW5jdGlvbkNvbXBvbmVudE5vZGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfRnVuY3Rpb25Db21wb25lbnROb2RlKTtcblxudmFyIF9JbnB1dCA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9JbnB1dCcpO1xuXG52YXIgX0lucHV0MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX0lucHV0KTtcblxudmFyIF9UZXh0YXJlYSA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9UZXh0YXJlYScpO1xuXG52YXIgX1RleHRhcmVhMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX1RleHRhcmVhKTtcblxudmFyIF9TZWxlY3QgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvU2VsZWN0Jyk7XG5cbnZhciBfU2VsZWN0MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX1NlbGVjdCk7XG5cbnZhciBfY29uc29sZSA9IHJlcXVpcmUoJy4vdXRpbHMvY29uc29sZScpO1xuXG52YXIgX2NvbnNvbGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY29uc29sZSk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbnZhciBXUkFQUEVSX0NPTVBPTkVOVFMgPSB7XG4gICAgaW5wdXQ6IF9JbnB1dDIuZGVmYXVsdCxcbiAgICB0ZXh0YXJlYTogX1RleHRhcmVhMi5kZWZhdWx0LFxuICAgIHNlbGVjdDogX1NlbGVjdDIuZGVmYXVsdFxufTsiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuZGVmYXVsdCA9IENvbXBvbmVudE5vZGU7XG5cbnZhciBfZW1wdHlPYmogPSByZXF1aXJlKCcuLi91dGlscy9lbXB0eU9iaicpO1xuXG52YXIgX2VtcHR5T2JqMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2VtcHR5T2JqKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuZnVuY3Rpb24gQ29tcG9uZW50Tm9kZShjb21wb25lbnQpIHtcbiAgICB0aGlzLnR5cGUgPSBDb21wb25lbnROb2RlO1xuICAgIHRoaXMuX2NvbXBvbmVudCA9IGNvbXBvbmVudDtcbiAgICB0aGlzLl9rZXkgPSBudWxsO1xuICAgIHRoaXMuX2F0dHJzID0gbnVsbDtcbiAgICB0aGlzLl9pbnN0YW5jZSA9IG51bGw7XG4gICAgdGhpcy5fY2hpbGRyZW4gPSBudWxsO1xuICAgIHRoaXMuX25zID0gbnVsbDtcbiAgICB0aGlzLl9jdHggPSBfZW1wdHlPYmoyLmRlZmF1bHQ7XG59XG5cbkNvbXBvbmVudE5vZGUucHJvdG90eXBlID0ge1xuICAgIGdldERvbU5vZGU6IGZ1bmN0aW9uIGdldERvbU5vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9pbnN0YW5jZS5nZXREb21Ob2RlKCk7XG4gICAgfSxcbiAgICBrZXk6IGZ1bmN0aW9uIGtleShfa2V5KSB7XG4gICAgICAgIHRoaXMuX2tleSA9IF9rZXk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgYXR0cnM6IGZ1bmN0aW9uIGF0dHJzKF9hdHRycykge1xuICAgICAgICB0aGlzLl9hdHRycyA9IF9hdHRycztcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBjaGlsZHJlbjogZnVuY3Rpb24gY2hpbGRyZW4oX2NoaWxkcmVuKSB7XG4gICAgICAgIHRoaXMuX2NoaWxkcmVuID0gX2NoaWxkcmVuO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGN0eDogZnVuY3Rpb24gY3R4KF9jdHgpIHtcbiAgICAgICAgdGhpcy5fY3R4ID0gX2N0eDtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICByZW5kZXJUb0RvbTogZnVuY3Rpb24gcmVuZGVyVG9Eb20ocGFyZW50Tm9kZSkge1xuICAgICAgICBpZiAoIXRoaXMuX25zICYmIHBhcmVudE5vZGUgJiYgcGFyZW50Tm9kZS5fbnMpIHtcbiAgICAgICAgICAgIHRoaXMuX25zID0gcGFyZW50Tm9kZS5fbnM7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0SW5zdGFuY2UoKS5yZW5kZXJUb0RvbSh0aGlzKTtcbiAgICB9LFxuICAgIHJlbmRlclRvU3RyaW5nOiBmdW5jdGlvbiByZW5kZXJUb1N0cmluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldEluc3RhbmNlKCkucmVuZGVyVG9TdHJpbmcoKTtcbiAgICB9LFxuICAgIGFkb3B0RG9tOiBmdW5jdGlvbiBhZG9wdERvbShkb21Ob2RlLCBwYXJlbnROb2RlKSB7XG4gICAgICAgIHRoaXMuX2dldEluc3RhbmNlKCkuYWRvcHREb20oZG9tTm9kZSwgcGFyZW50Tm9kZSk7XG4gICAgfSxcbiAgICBtb3VudDogZnVuY3Rpb24gbW91bnQoKSB7XG4gICAgICAgIHRoaXMuX2luc3RhbmNlLmdldFJvb3ROb2RlKCkubW91bnQoKTtcbiAgICAgICAgdGhpcy5faW5zdGFuY2UubW91bnQoKTtcbiAgICB9LFxuICAgIHVubW91bnQ6IGZ1bmN0aW9uIHVubW91bnQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9pbnN0YW5jZSkge1xuICAgICAgICAgICAgdGhpcy5faW5zdGFuY2UuZ2V0Um9vdE5vZGUoKS51bm1vdW50KCk7XG4gICAgICAgICAgICB0aGlzLl9pbnN0YW5jZS51bm1vdW50KCk7XG4gICAgICAgICAgICB0aGlzLl9pbnN0YW5jZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIHBhdGNoOiBmdW5jdGlvbiBwYXRjaChub2RlLCBwYXJlbnROb2RlKSB7XG4gICAgICAgIGlmICh0aGlzID09PSBub2RlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIW5vZGUuX25zICYmIHBhcmVudE5vZGUgJiYgcGFyZW50Tm9kZS5fbnMpIHtcbiAgICAgICAgICAgIG5vZGUuX25zID0gcGFyZW50Tm9kZS5fbnM7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaW5zdGFuY2UgPSB0aGlzLl9nZXRJbnN0YW5jZSgpO1xuXG4gICAgICAgIGlmICh0aGlzLnR5cGUgPT09IG5vZGUudHlwZSkge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NvbXBvbmVudCA9PT0gbm9kZS5fY29tcG9uZW50KSB7XG4gICAgICAgICAgICAgICAgaW5zdGFuY2UucGF0Y2gobm9kZS5fYXR0cnMsIG5vZGUuX2NoaWxkcmVuLCBub2RlLl9jdHgsIHBhcmVudE5vZGUpO1xuICAgICAgICAgICAgICAgIG5vZGUuX2luc3RhbmNlID0gaW5zdGFuY2U7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlLnVubW91bnQoKTtcbiAgICAgICAgICAgICAgICB2YXIgbmV3SW5zdGFuY2UgPSBub2RlLl9nZXRJbnN0YW5jZSgpO1xuICAgICAgICAgICAgICAgIGluc3RhbmNlLmdldFJvb3ROb2RlKCkucGF0Y2gobmV3SW5zdGFuY2UuZ2V0Um9vdE5vZGUoKSwgcGFyZW50Tm9kZSk7XG4gICAgICAgICAgICAgICAgbmV3SW5zdGFuY2UubW91bnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGluc3RhbmNlLnVubW91bnQoKTtcbiAgICAgICAgICAgIGluc3RhbmNlLmdldFJvb3ROb2RlKCkucGF0Y2gobm9kZSwgcGFyZW50Tm9kZSk7XG4gICAgICAgIH1cbiAgICB9LFxuICAgIF9nZXRJbnN0YW5jZTogZnVuY3Rpb24gX2dldEluc3RhbmNlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faW5zdGFuY2UgfHwgKHRoaXMuX2luc3RhbmNlID0gbmV3IHRoaXMuX2NvbXBvbmVudCh0aGlzLl9hdHRycywgdGhpcy5fY2hpbGRyZW4sIHRoaXMuX2N0eCkpO1xuICAgIH1cbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3R5cGVvZiA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgU3ltYm9sLml0ZXJhdG9yID09PSBcInN5bWJvbFwiID8gZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gdHlwZW9mIG9iajsgfSA6IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIG9iaiAmJiB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb2JqLmNvbnN0cnVjdG9yID09PSBTeW1ib2wgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajsgfTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0cy5kZWZhdWx0ID0gRnVuY3Rpb25Db21wb25lbnROb2RlO1xuXG52YXIgX1RhZ05vZGUgPSByZXF1aXJlKCcuL1RhZ05vZGUnKTtcblxudmFyIF9UYWdOb2RlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX1RhZ05vZGUpO1xuXG52YXIgX2VtcHR5T2JqID0gcmVxdWlyZSgnLi4vdXRpbHMvZW1wdHlPYmonKTtcblxudmFyIF9lbXB0eU9iajIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9lbXB0eU9iaik7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbmZ1bmN0aW9uIEZ1bmN0aW9uQ29tcG9uZW50Tm9kZShjb21wb25lbnQpIHtcbiAgICB0aGlzLnR5cGUgPSBGdW5jdGlvbkNvbXBvbmVudE5vZGU7XG4gICAgdGhpcy5fY29tcG9uZW50ID0gY29tcG9uZW50O1xuICAgIHRoaXMuX2tleSA9IG51bGw7XG4gICAgdGhpcy5fYXR0cnMgPSBfZW1wdHlPYmoyLmRlZmF1bHQ7XG4gICAgdGhpcy5fcm9vdE5vZGUgPSBudWxsO1xuICAgIHRoaXMuX2NoaWxkcmVuID0gbnVsbDtcbiAgICB0aGlzLl9ucyA9IG51bGw7XG4gICAgdGhpcy5fY3R4ID0gX2VtcHR5T2JqMi5kZWZhdWx0O1xufVxuXG5GdW5jdGlvbkNvbXBvbmVudE5vZGUucHJvdG90eXBlID0ge1xuICAgIGdldERvbU5vZGU6IGZ1bmN0aW9uIGdldERvbU5vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9yb290Tm9kZS5nZXREb21Ob2RlKCk7XG4gICAgfSxcbiAgICBrZXk6IGZ1bmN0aW9uIGtleShfa2V5KSB7XG4gICAgICAgIHRoaXMuX2tleSA9IF9rZXk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgYXR0cnM6IGZ1bmN0aW9uIGF0dHJzKF9hdHRycykge1xuICAgICAgICB0aGlzLl9hdHRycyA9IF9hdHRycztcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBjaGlsZHJlbjogZnVuY3Rpb24gY2hpbGRyZW4oX2NoaWxkcmVuKSB7XG4gICAgICAgIHRoaXMuX2NoaWxkcmVuID0gX2NoaWxkcmVuO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGN0eDogZnVuY3Rpb24gY3R4KF9jdHgpIHtcbiAgICAgICAgdGhpcy5fY3R4ID0gX2N0eDtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICByZW5kZXJUb0RvbTogZnVuY3Rpb24gcmVuZGVyVG9Eb20ocGFyZW50Tm9kZSkge1xuICAgICAgICBpZiAoIXRoaXMuX25zICYmIHBhcmVudE5vZGUgJiYgcGFyZW50Tm9kZS5fbnMpIHtcbiAgICAgICAgICAgIHRoaXMuX25zID0gcGFyZW50Tm9kZS5fbnM7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5fZ2V0Um9vdE5vZGUoKS5yZW5kZXJUb0RvbSh0aGlzKTtcbiAgICB9LFxuICAgIHJlbmRlclRvU3RyaW5nOiBmdW5jdGlvbiByZW5kZXJUb1N0cmluZygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFJvb3ROb2RlKCkucmVuZGVyVG9TdHJpbmcoKTtcbiAgICB9LFxuICAgIGFkb3B0RG9tOiBmdW5jdGlvbiBhZG9wdERvbShkb21Ob2RlLCBwYXJlbnROb2RlKSB7XG4gICAgICAgIHRoaXMuX2dldFJvb3ROb2RlKCkuYWRvcHREb20oZG9tTm9kZSwgcGFyZW50Tm9kZSk7XG4gICAgfSxcbiAgICBtb3VudDogZnVuY3Rpb24gbW91bnQoKSB7XG4gICAgICAgIHRoaXMuX2dldFJvb3ROb2RlKCkubW91bnQoKTtcbiAgICB9LFxuICAgIHVubW91bnQ6IGZ1bmN0aW9uIHVubW91bnQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9yb290Tm9kZSkge1xuICAgICAgICAgICAgdGhpcy5fcm9vdE5vZGUudW5tb3VudCgpO1xuICAgICAgICAgICAgdGhpcy5fcm9vdE5vZGUgPSBudWxsO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBwYXRjaDogZnVuY3Rpb24gcGF0Y2gobm9kZSwgcGFyZW50Tm9kZSkge1xuICAgICAgICBpZiAodGhpcyA9PT0gbm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFub2RlLl9ucyAmJiBwYXJlbnROb2RlICYmIHBhcmVudE5vZGUuX25zKSB7XG4gICAgICAgICAgICBub2RlLl9ucyA9IHBhcmVudE5vZGUuX25zO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZ2V0Um9vdE5vZGUoKS5wYXRjaCh0aGlzLnR5cGUgPT09IG5vZGUudHlwZSA/IG5vZGUuX2dldFJvb3ROb2RlKCkgOiBub2RlLCBwYXJlbnROb2RlKTtcbiAgICB9LFxuICAgIF9nZXRSb290Tm9kZTogZnVuY3Rpb24gX2dldFJvb3ROb2RlKCkge1xuICAgICAgICBpZiAodGhpcy5fcm9vdE5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9yb290Tm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciByb290Tm9kZSA9IHRoaXMuX2NvbXBvbmVudCh0aGlzLl9hdHRycywgdGhpcy5fY2hpbGRyZW4sIHRoaXMuX2N0eCkgfHwgbmV3IF9UYWdOb2RlMi5kZWZhdWx0KCdub3NjcmlwdCcpO1xuXG4gICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgICBpZiAoKHR5cGVvZiByb290Tm9kZSA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2Yocm9vdE5vZGUpKSAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShyb290Tm9kZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGdW5jdGlvbiBjb21wb25lbnQgbXVzdCByZXR1cm4gYSBzaW5nbGUgbm9kZSBvYmplY3Qgb24gdGhlIHRvcCBsZXZlbCcpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcm9vdE5vZGUuY3R4KHRoaXMuX2N0eCk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX3Jvb3ROb2RlID0gcm9vdE5vZGU7XG4gICAgfVxufTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBfdHlwZW9mID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBTeW1ib2wuaXRlcmF0b3IgPT09IFwic3ltYm9sXCIgPyBmdW5jdGlvbiAob2JqKSB7IHJldHVybiB0eXBlb2Ygb2JqOyB9IDogZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gb2JqICYmIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvYmouY29uc3RydWN0b3IgPT09IFN5bWJvbCA/IFwic3ltYm9sXCIgOiB0eXBlb2Ygb2JqOyB9O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLmRlZmF1bHQgPSBUYWdOb2RlO1xuXG52YXIgX3BhdGNoT3BzID0gcmVxdWlyZSgnLi4vY2xpZW50L3BhdGNoT3BzJyk7XG5cbnZhciBfcGF0Y2hPcHMyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfcGF0Y2hPcHMpO1xuXG52YXIgX2RvbUF0dHJzID0gcmVxdWlyZSgnLi4vY2xpZW50L2RvbUF0dHJzJyk7XG5cbnZhciBfZG9tQXR0cnMyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZG9tQXR0cnMpO1xuXG52YXIgX2RvbUV2ZW50TWFuYWdlciA9IHJlcXVpcmUoJy4uL2NsaWVudC9ldmVudHMvZG9tRXZlbnRNYW5hZ2VyJyk7XG5cbnZhciBfYXR0cnNUb0V2ZW50cyA9IHJlcXVpcmUoJy4uL2NsaWVudC9ldmVudHMvYXR0cnNUb0V2ZW50cycpO1xuXG52YXIgX2F0dHJzVG9FdmVudHMyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfYXR0cnNUb0V2ZW50cyk7XG5cbnZhciBfZXNjYXBlSHRtbCA9IHJlcXVpcmUoJy4uL3V0aWxzL2VzY2FwZUh0bWwnKTtcblxudmFyIF9lc2NhcGVIdG1sMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2VzY2FwZUh0bWwpO1xuXG52YXIgX2lzSW5BcnJheSA9IHJlcXVpcmUoJy4uL3V0aWxzL2lzSW5BcnJheScpO1xuXG52YXIgX2lzSW5BcnJheTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9pc0luQXJyYXkpO1xuXG52YXIgX2NvbnNvbGUgPSByZXF1aXJlKCcuLi91dGlscy9jb25zb2xlJyk7XG5cbnZhciBfY29uc29sZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jb25zb2xlKTtcblxudmFyIF9lbXB0eU9iaiA9IHJlcXVpcmUoJy4uL3V0aWxzL2VtcHR5T2JqJyk7XG5cbnZhciBfZW1wdHlPYmoyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZW1wdHlPYmopO1xuXG52YXIgX2Jyb3dzZXJzID0gcmVxdWlyZSgnLi4vY2xpZW50L2Jyb3dzZXJzJyk7XG5cbnZhciBfY3JlYXRlRWxlbWVudCA9IHJlcXVpcmUoJy4uL2NsaWVudC91dGlscy9jcmVhdGVFbGVtZW50Jyk7XG5cbnZhciBfY3JlYXRlRWxlbWVudDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jcmVhdGVFbGVtZW50KTtcblxudmFyIF9jcmVhdGVFbGVtZW50QnlIdG1sID0gcmVxdWlyZSgnLi4vY2xpZW50L3V0aWxzL2NyZWF0ZUVsZW1lbnRCeUh0bWwnKTtcblxudmFyIF9jcmVhdGVFbGVtZW50QnlIdG1sMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2NyZWF0ZUVsZW1lbnRCeUh0bWwpO1xuXG52YXIgX0NvbXBvbmVudE5vZGUgPSByZXF1aXJlKCcuL0NvbXBvbmVudE5vZGUnKTtcblxudmFyIF9Db21wb25lbnROb2RlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX0NvbXBvbmVudE5vZGUpO1xuXG52YXIgX0Z1bmN0aW9uQ29tcG9uZW50Tm9kZSA9IHJlcXVpcmUoJy4vRnVuY3Rpb25Db21wb25lbnROb2RlJyk7XG5cbnZhciBfRnVuY3Rpb25Db21wb25lbnROb2RlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX0Z1bmN0aW9uQ29tcG9uZW50Tm9kZSk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbnZhciBTSE9SVF9UQUdTID0ge1xuICAgIGFyZWE6IHRydWUsXG4gICAgYmFzZTogdHJ1ZSxcbiAgICBicjogdHJ1ZSxcbiAgICBjb2w6IHRydWUsXG4gICAgY29tbWFuZDogdHJ1ZSxcbiAgICBlbWJlZDogdHJ1ZSxcbiAgICBocjogdHJ1ZSxcbiAgICBpbWc6IHRydWUsXG4gICAgaW5wdXQ6IHRydWUsXG4gICAga2V5Z2VuOiB0cnVlLFxuICAgIGxpbms6IHRydWUsXG4gICAgbWVudWl0ZW06IHRydWUsXG4gICAgbWV0YTogdHJ1ZSxcbiAgICBwYXJhbTogdHJ1ZSxcbiAgICBzb3VyY2U6IHRydWUsXG4gICAgdHJhY2s6IHRydWUsXG4gICAgd2JyOiB0cnVlXG59LFxuICAgIFVTRV9ET01fU1RSSU5HUyA9IF9icm93c2Vycy5pc1RyaWRlbnQgfHwgX2Jyb3dzZXJzLmlzRWRnZTtcblxuZnVuY3Rpb24gVGFnTm9kZSh0YWcpIHtcbiAgICB0aGlzLnR5cGUgPSBUYWdOb2RlO1xuICAgIHRoaXMuX3RhZyA9IHRhZztcbiAgICB0aGlzLl9kb21Ob2RlID0gbnVsbDtcbiAgICB0aGlzLl9rZXkgPSBudWxsO1xuICAgIHRoaXMuX25zID0gbnVsbDtcbiAgICB0aGlzLl9hdHRycyA9IG51bGw7XG4gICAgdGhpcy5fY2hpbGRyZW4gPSBudWxsO1xuICAgIHRoaXMuX2VzY2FwZUNoaWxkcmVuID0gdHJ1ZTtcbiAgICB0aGlzLl9jdHggPSBfZW1wdHlPYmoyLmRlZmF1bHQ7XG59XG5cblRhZ05vZGUucHJvdG90eXBlID0ge1xuICAgIGdldERvbU5vZGU6IGZ1bmN0aW9uIGdldERvbU5vZGUoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9kb21Ob2RlO1xuICAgIH0sXG4gICAga2V5OiBmdW5jdGlvbiBrZXkoX2tleSkge1xuICAgICAgICB0aGlzLl9rZXkgPSBfa2V5O1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIG5zOiBmdW5jdGlvbiBucyhfbnMpIHtcbiAgICAgICAgdGhpcy5fbnMgPSBfbnM7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgYXR0cnM6IGZ1bmN0aW9uIGF0dHJzKF9hdHRycykge1xuICAgICAgICB0aGlzLl9hdHRycyA9IF9hdHRycztcblxuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgICAgY2hlY2tBdHRycyhfYXR0cnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBjaGlsZHJlbjogZnVuY3Rpb24gY2hpbGRyZW4oX2NoaWxkcmVuKSB7XG4gICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fY2hpbGRyZW4gIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBfY29uc29sZTIuZGVmYXVsdC53YXJuKCdZb3VcXCdyZSB0cnlpbmcgdG8gc2V0IGNoaWxkcmVuIG9yIGh0bWwgbW9yZSB0aGFuIG9uY2Ugb3IgcGFzcyBib3RoIGNoaWxkcmVuIGFuZCBodG1sLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2hpbGRyZW4gPSBwcm9jZXNzQ2hpbGRyZW4oX2NoaWxkcmVuKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBjdHg6IGZ1bmN0aW9uIGN0eChfY3R4KSB7XG4gICAgICAgIGlmIChfY3R4ICE9PSBfZW1wdHlPYmoyLmRlZmF1bHQpIHtcbiAgICAgICAgICAgIHRoaXMuX2N0eCA9IF9jdHg7XG5cbiAgICAgICAgICAgIHZhciBjaGlsZHJlbiA9IHRoaXMuX2NoaWxkcmVuO1xuXG4gICAgICAgICAgICBpZiAoY2hpbGRyZW4gJiYgdHlwZW9mIGNoaWxkcmVuICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHZhciBsZW4gPSBjaGlsZHJlbi5sZW5ndGg7XG4gICAgICAgICAgICAgICAgdmFyIGkgPSAwO1xuXG4gICAgICAgICAgICAgICAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW5baSsrXS5jdHgoX2N0eCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBodG1sOiBmdW5jdGlvbiBodG1sKF9odG1sKSB7XG4gICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgICBpZiAodGhpcy5fY2hpbGRyZW4gIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBfY29uc29sZTIuZGVmYXVsdC53YXJuKCdZb3VcXCdyZSB0cnlpbmcgdG8gc2V0IGNoaWxkcmVuIG9yIGh0bWwgbW9yZSB0aGFuIG9uY2Ugb3IgcGFzcyBib3RoIGNoaWxkcmVuIGFuZCBodG1sLicpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fY2hpbGRyZW4gPSBfaHRtbDtcbiAgICAgICAgdGhpcy5fZXNjYXBlQ2hpbGRyZW4gPSBmYWxzZTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICByZW5kZXJUb0RvbTogZnVuY3Rpb24gcmVuZGVyVG9Eb20ocGFyZW50Tm9kZSkge1xuICAgICAgICBpZiAoIXRoaXMuX25zICYmIHBhcmVudE5vZGUgJiYgcGFyZW50Tm9kZS5fbnMpIHtcbiAgICAgICAgICAgIHRoaXMuX25zID0gcGFyZW50Tm9kZS5fbnM7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2hpbGRyZW4gPSB0aGlzLl9jaGlsZHJlbjtcblxuICAgICAgICBpZiAoVVNFX0RPTV9TVFJJTkdTICYmIGNoaWxkcmVuICYmIHR5cGVvZiBjaGlsZHJlbiAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHZhciBfZG9tTm9kZSA9ICgwLCBfY3JlYXRlRWxlbWVudEJ5SHRtbDIuZGVmYXVsdCkodGhpcy5yZW5kZXJUb1N0cmluZygpLCB0aGlzLl90YWcsIHRoaXMuX25zKTtcbiAgICAgICAgICAgIHRoaXMuYWRvcHREb20oX2RvbU5vZGUsIHBhcmVudE5vZGUpO1xuICAgICAgICAgICAgcmV0dXJuIF9kb21Ob2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGRvbU5vZGUgPSAoMCwgX2NyZWF0ZUVsZW1lbnQyLmRlZmF1bHQpKHRoaXMuX25zLCB0aGlzLl90YWcpLFxuICAgICAgICAgICAgYXR0cnMgPSB0aGlzLl9hdHRycztcblxuICAgICAgICBpZiAoY2hpbGRyZW4pIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2hpbGRyZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fZXNjYXBlQ2hpbGRyZW4gPyBkb21Ob2RlLnRleHRDb250ZW50ID0gY2hpbGRyZW4gOiBkb21Ob2RlLmlubmVySFRNTCA9IGNoaWxkcmVuO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB2YXIgaSA9IDA7XG4gICAgICAgICAgICAgICAgdmFyIGxlbiA9IGNoaWxkcmVuLmxlbmd0aDtcblxuICAgICAgICAgICAgICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGRvbU5vZGUuYXBwZW5kQ2hpbGQoY2hpbGRyZW5baSsrXS5yZW5kZXJUb0RvbSh0aGlzKSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0dHJzKSB7XG4gICAgICAgICAgICB2YXIgbmFtZSA9IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGZvciAobmFtZSBpbiBhdHRycykge1xuICAgICAgICAgICAgICAgICh2YWx1ZSA9IGF0dHJzW25hbWVdKSAhPSBudWxsICYmIChfYXR0cnNUb0V2ZW50czIuZGVmYXVsdFtuYW1lXSA/ICgwLCBfZG9tRXZlbnRNYW5hZ2VyLmFkZExpc3RlbmVyKShkb21Ob2RlLCBfYXR0cnNUb0V2ZW50czIuZGVmYXVsdFtuYW1lXSwgdmFsdWUpIDogKDAsIF9kb21BdHRyczIuZGVmYXVsdCkobmFtZSkuc2V0KGRvbU5vZGUsIG5hbWUsIHZhbHVlKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5fZG9tTm9kZSA9IGRvbU5vZGU7XG4gICAgfSxcbiAgICByZW5kZXJUb1N0cmluZzogZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmcoKSB7XG4gICAgICAgIHZhciB0YWcgPSB0aGlzLl90YWcsXG4gICAgICAgICAgICBucyA9IHRoaXMuX25zLFxuICAgICAgICAgICAgYXR0cnMgPSB0aGlzLl9hdHRycztcblxuICAgICAgICB2YXIgY2hpbGRyZW4gPSB0aGlzLl9jaGlsZHJlbixcbiAgICAgICAgICAgIHJlcyA9ICc8JyArIHRhZztcblxuICAgICAgICBpZiAobnMpIHtcbiAgICAgICAgICAgIHJlcyArPSAnIHhtbG5zPVwiJyArIG5zICsgJ1wiJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdHRycykge1xuICAgICAgICAgICAgdmFyIG5hbWUgPSB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgdmFsdWUgPSB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgYXR0ckh0bWwgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gYXR0cnMpIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGF0dHJzW25hbWVdO1xuXG4gICAgICAgICAgICAgICAgaWYgKHZhbHVlICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKG5hbWUgPT09ICd2YWx1ZScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHN3aXRjaCAodGFnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAndGV4dGFyZWEnOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbiA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3NlbGVjdCc6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuY3R4KHsgdmFsdWU6IHZhbHVlLCBtdWx0aXBsZTogYXR0cnMubXVsdGlwbGUgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2FzZSAnb3B0aW9uJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2N0eC5tdWx0aXBsZSA/ICgwLCBfaXNJbkFycmF5Mi5kZWZhdWx0KSh0aGlzLl9jdHgudmFsdWUsIHZhbHVlKSA6IHRoaXMuX2N0eC52YWx1ZSA9PT0gdmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcyArPSAnICcgKyAoMCwgX2RvbUF0dHJzMi5kZWZhdWx0KSgnc2VsZWN0ZWQnKS50b1N0cmluZygnc2VsZWN0ZWQnLCB0cnVlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgaWYgKCFfYXR0cnNUb0V2ZW50czIuZGVmYXVsdFtuYW1lXSAmJiAoYXR0ckh0bWwgPSAoMCwgX2RvbUF0dHJzMi5kZWZhdWx0KShuYW1lKS50b1N0cmluZyhuYW1lLCB2YWx1ZSkpKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMgKz0gJyAnICsgYXR0ckh0bWw7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoU0hPUlRfVEFHU1t0YWddKSB7XG4gICAgICAgICAgICByZXMgKz0gJy8+JztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlcyArPSAnPic7XG5cbiAgICAgICAgICAgIGlmIChjaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY2hpbGRyZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcyArPSB0aGlzLl9lc2NhcGVDaGlsZHJlbiA/ICgwLCBfZXNjYXBlSHRtbDIuZGVmYXVsdCkoY2hpbGRyZW4pIDogY2hpbGRyZW47XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICAgICAgICAgICAgICB2YXIgbGVuID0gY2hpbGRyZW4ubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMgKz0gY2hpbGRyZW5baSsrXS5yZW5kZXJUb1N0cmluZygpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXMgKz0gJzwvJyArIHRhZyArICc+JztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfSxcbiAgICBhZG9wdERvbTogZnVuY3Rpb24gYWRvcHREb20oZG9tTm9kZSwgcGFyZW50Tm9kZSkge1xuICAgICAgICBpZiAoIXRoaXMuX25zICYmIHBhcmVudE5vZGUgJiYgcGFyZW50Tm9kZS5fbnMpIHtcbiAgICAgICAgICAgIHRoaXMuX25zID0gcGFyZW50Tm9kZS5fbnM7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLl9kb21Ob2RlID0gZG9tTm9kZTtcblxuICAgICAgICB2YXIgYXR0cnMgPSB0aGlzLl9hdHRycyxcbiAgICAgICAgICAgIGNoaWxkcmVuID0gdGhpcy5fY2hpbGRyZW47XG5cbiAgICAgICAgaWYgKGF0dHJzKSB7XG4gICAgICAgICAgICB2YXIgbmFtZSA9IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAgIGZvciAobmFtZSBpbiBhdHRycykge1xuICAgICAgICAgICAgICAgIGlmICgodmFsdWUgPSBhdHRyc1tuYW1lXSkgIT0gbnVsbCAmJiBfYXR0cnNUb0V2ZW50czIuZGVmYXVsdFtuYW1lXSkge1xuICAgICAgICAgICAgICAgICAgICAoMCwgX2RvbUV2ZW50TWFuYWdlci5hZGRMaXN0ZW5lcikoZG9tTm9kZSwgX2F0dHJzVG9FdmVudHMyLmRlZmF1bHRbbmFtZV0sIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoY2hpbGRyZW4gJiYgdHlwZW9mIGNoaWxkcmVuICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICAgICAgdmFyIGxlbiA9IGNoaWxkcmVuLmxlbmd0aDtcblxuICAgICAgICAgICAgaWYgKGxlbikge1xuICAgICAgICAgICAgICAgIHZhciBkb21DaGlsZHJlbiA9IGRvbU5vZGUuY2hpbGROb2RlcztcbiAgICAgICAgICAgICAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbltpXS5hZG9wdERvbShkb21DaGlsZHJlbltpXSwgdGhpcyk7XG4gICAgICAgICAgICAgICAgICAgICsraTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIG1vdW50OiBmdW5jdGlvbiBtb3VudCgpIHtcbiAgICAgICAgdmFyIGNoaWxkcmVuID0gdGhpcy5fY2hpbGRyZW47XG5cbiAgICAgICAgaWYgKGNoaWxkcmVuICYmIHR5cGVvZiBjaGlsZHJlbiAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgICAgIHZhciBsZW4gPSBjaGlsZHJlbi5sZW5ndGg7XG5cbiAgICAgICAgICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRyZW5baSsrXS5tb3VudCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICB1bm1vdW50OiBmdW5jdGlvbiB1bm1vdW50KCkge1xuICAgICAgICB2YXIgY2hpbGRyZW4gPSB0aGlzLl9jaGlsZHJlbjtcblxuICAgICAgICBpZiAoY2hpbGRyZW4gJiYgdHlwZW9mIGNoaWxkcmVuICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICAgICAgdmFyIGxlbiA9IGNoaWxkcmVuLmxlbmd0aDtcblxuICAgICAgICAgICAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICBjaGlsZHJlbltpKytdLnVubW91bnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgICgwLCBfZG9tRXZlbnRNYW5hZ2VyLnJlbW92ZUxpc3RlbmVycykodGhpcy5fZG9tTm9kZSk7XG5cbiAgICAgICAgdGhpcy5fZG9tTm9kZSA9IG51bGw7XG4gICAgfSxcbiAgICBwYXRjaDogZnVuY3Rpb24gcGF0Y2gobm9kZSwgcGFyZW50Tm9kZSkge1xuICAgICAgICBpZiAodGhpcyA9PT0gbm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFub2RlLl9ucyAmJiBwYXJlbnROb2RlICYmIHBhcmVudE5vZGUuX25zKSB7XG4gICAgICAgICAgICBub2RlLl9ucyA9IHBhcmVudE5vZGUuX25zO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMudHlwZSAhPT0gbm9kZS50eXBlKSB7XG4gICAgICAgICAgICBzd2l0Y2ggKG5vZGUudHlwZSkge1xuICAgICAgICAgICAgICAgIGNhc2UgX0NvbXBvbmVudE5vZGUyLmRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIHZhciBpbnN0YW5jZSA9IG5vZGUuX2dldEluc3RhbmNlKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucGF0Y2goaW5zdGFuY2UuZ2V0Um9vdE5vZGUoKSwgcGFyZW50Tm9kZSk7XG4gICAgICAgICAgICAgICAgICAgIGluc3RhbmNlLm1vdW50KCk7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgY2FzZSBfRnVuY3Rpb25Db21wb25lbnROb2RlMi5kZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICB0aGlzLnBhdGNoKG5vZGUuX2dldFJvb3ROb2RlKCksIHBhcmVudE5vZGUpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIF9wYXRjaE9wczIuZGVmYXVsdC5yZXBsYWNlKHBhcmVudE5vZGUgfHwgbnVsbCwgdGhpcywgbm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fdGFnICE9PSBub2RlLl90YWcgfHwgdGhpcy5fbnMgIT09IG5vZGUuX25zKSB7XG4gICAgICAgICAgICBfcGF0Y2hPcHMyLmRlZmF1bHQucmVwbGFjZShwYXJlbnROb2RlIHx8IG51bGwsIHRoaXMsIG5vZGUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZG9tTm9kZSAmJiAobm9kZS5fZG9tTm9kZSA9IHRoaXMuX2RvbU5vZGUpO1xuXG4gICAgICAgIHRoaXMuX3BhdGNoQ2hpbGRyZW4obm9kZSk7XG4gICAgICAgIHRoaXMuX3BhdGNoQXR0cnMobm9kZSk7XG4gICAgfSxcbiAgICBfcGF0Y2hDaGlsZHJlbjogZnVuY3Rpb24gX3BhdGNoQ2hpbGRyZW4obm9kZSkge1xuICAgICAgICB2YXIgY2hpbGRyZW5BID0gdGhpcy5fY2hpbGRyZW4sXG4gICAgICAgICAgICBjaGlsZHJlbkIgPSBub2RlLl9jaGlsZHJlbjtcblxuICAgICAgICBpZiAoY2hpbGRyZW5BID09PSBjaGlsZHJlbkIpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBpc0NoaWxkcmVuQVRleHQgPSB0eXBlb2YgY2hpbGRyZW5BID09PSAnc3RyaW5nJyxcbiAgICAgICAgICAgIGlzQ2hpbGRyZW5CVGV4dCA9IHR5cGVvZiBjaGlsZHJlbkIgPT09ICdzdHJpbmcnO1xuXG4gICAgICAgIGlmIChpc0NoaWxkcmVuQlRleHQpIHtcbiAgICAgICAgICAgIGlmIChpc0NoaWxkcmVuQVRleHQpIHtcbiAgICAgICAgICAgICAgICBfcGF0Y2hPcHMyLmRlZmF1bHQudXBkYXRlVGV4dCh0aGlzLCBjaGlsZHJlbkIsIG5vZGUuX2VzY2FwZUNoaWxkcmVuKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNoaWxkcmVuQSAmJiBjaGlsZHJlbkEubGVuZ3RoICYmIF9wYXRjaE9wczIuZGVmYXVsdC5yZW1vdmVDaGlsZHJlbih0aGlzKTtcbiAgICAgICAgICAgIGNoaWxkcmVuQiAmJiBfcGF0Y2hPcHMyLmRlZmF1bHQudXBkYXRlVGV4dCh0aGlzLCBjaGlsZHJlbkIsIG5vZGUuX2VzY2FwZUNoaWxkcmVuKTtcblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFjaGlsZHJlbkIgfHwgIWNoaWxkcmVuQi5sZW5ndGgpIHtcbiAgICAgICAgICAgIGlmIChjaGlsZHJlbkEpIHtcbiAgICAgICAgICAgICAgICBpc0NoaWxkcmVuQVRleHQgPyBfcGF0Y2hPcHMyLmRlZmF1bHQucmVtb3ZlVGV4dCh0aGlzKSA6IGNoaWxkcmVuQS5sZW5ndGggJiYgX3BhdGNoT3BzMi5kZWZhdWx0LnJlbW92ZUNoaWxkcmVuKHRoaXMpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaXNDaGlsZHJlbkFUZXh0ICYmIGNoaWxkcmVuQSkge1xuICAgICAgICAgICAgX3BhdGNoT3BzMi5kZWZhdWx0LnJlbW92ZVRleHQodGhpcyk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2hpbGRyZW5CTGVuID0gY2hpbGRyZW5CLmxlbmd0aDtcblxuICAgICAgICBpZiAoaXNDaGlsZHJlbkFUZXh0IHx8ICFjaGlsZHJlbkEgfHwgIWNoaWxkcmVuQS5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBpQiA9IDA7XG4gICAgICAgICAgICB3aGlsZSAoaUIgPCBjaGlsZHJlbkJMZW4pIHtcbiAgICAgICAgICAgICAgICBfcGF0Y2hPcHMyLmRlZmF1bHQuYXBwZW5kQ2hpbGQobm9kZSwgY2hpbGRyZW5CW2lCKytdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjaGlsZHJlbkFMZW4gPSBjaGlsZHJlbkEubGVuZ3RoO1xuXG4gICAgICAgIGlmIChjaGlsZHJlbkFMZW4gPT09IDEgJiYgY2hpbGRyZW5CTGVuID09PSAxKSB7XG4gICAgICAgICAgICBjaGlsZHJlbkFbMF0ucGF0Y2goY2hpbGRyZW5CWzBdLCBub2RlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBsZWZ0SWR4QSA9IDAsXG4gICAgICAgICAgICByaWdodElkeEEgPSBjaGlsZHJlbkFMZW4gLSAxLFxuICAgICAgICAgICAgbGVmdENoaWxkQSA9IGNoaWxkcmVuQVtsZWZ0SWR4QV0sXG4gICAgICAgICAgICBsZWZ0Q2hpbGRBS2V5ID0gbGVmdENoaWxkQS5fa2V5LFxuICAgICAgICAgICAgcmlnaHRDaGlsZEEgPSBjaGlsZHJlbkFbcmlnaHRJZHhBXSxcbiAgICAgICAgICAgIHJpZ2h0Q2hpbGRBS2V5ID0gcmlnaHRDaGlsZEEuX2tleSxcbiAgICAgICAgICAgIGxlZnRJZHhCID0gMCxcbiAgICAgICAgICAgIHJpZ2h0SWR4QiA9IGNoaWxkcmVuQkxlbiAtIDEsXG4gICAgICAgICAgICBsZWZ0Q2hpbGRCID0gY2hpbGRyZW5CW2xlZnRJZHhCXSxcbiAgICAgICAgICAgIGxlZnRDaGlsZEJLZXkgPSBsZWZ0Q2hpbGRCLl9rZXksXG4gICAgICAgICAgICByaWdodENoaWxkQiA9IGNoaWxkcmVuQltyaWdodElkeEJdLFxuICAgICAgICAgICAgcmlnaHRDaGlsZEJLZXkgPSByaWdodENoaWxkQi5fa2V5LFxuICAgICAgICAgICAgdXBkYXRlTGVmdElkeEEgPSBmYWxzZSxcbiAgICAgICAgICAgIHVwZGF0ZVJpZ2h0SWR4QSA9IGZhbHNlLFxuICAgICAgICAgICAgdXBkYXRlTGVmdElkeEIgPSBmYWxzZSxcbiAgICAgICAgICAgIHVwZGF0ZVJpZ2h0SWR4QiA9IGZhbHNlLFxuICAgICAgICAgICAgY2hpbGRyZW5BSW5kaWNlc1RvU2tpcCA9IHt9LFxuICAgICAgICAgICAgY2hpbGRyZW5BS2V5cyA9IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGZvdW5kQUNoaWxkSWR4ID0gdW5kZWZpbmVkLFxuICAgICAgICAgICAgZm91bmRBQ2hpbGQgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgd2hpbGUgKGxlZnRJZHhBIDw9IHJpZ2h0SWR4QSAmJiBsZWZ0SWR4QiA8PSByaWdodElkeEIpIHtcbiAgICAgICAgICAgIGlmIChjaGlsZHJlbkFJbmRpY2VzVG9Ta2lwW2xlZnRJZHhBXSkge1xuICAgICAgICAgICAgICAgIHVwZGF0ZUxlZnRJZHhBID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2hpbGRyZW5BSW5kaWNlc1RvU2tpcFtyaWdodElkeEFdKSB7XG4gICAgICAgICAgICAgICAgdXBkYXRlUmlnaHRJZHhBID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobGVmdENoaWxkQUtleSA9PT0gbGVmdENoaWxkQktleSkge1xuICAgICAgICAgICAgICAgIGxlZnRDaGlsZEEucGF0Y2gobGVmdENoaWxkQiwgbm9kZSk7XG4gICAgICAgICAgICAgICAgdXBkYXRlTGVmdElkeEEgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHVwZGF0ZUxlZnRJZHhCID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocmlnaHRDaGlsZEFLZXkgPT09IHJpZ2h0Q2hpbGRCS2V5KSB7XG4gICAgICAgICAgICAgICAgcmlnaHRDaGlsZEEucGF0Y2gocmlnaHRDaGlsZEIsIG5vZGUpO1xuICAgICAgICAgICAgICAgIHVwZGF0ZVJpZ2h0SWR4QSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdXBkYXRlUmlnaHRJZHhCID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobGVmdENoaWxkQUtleSAhPSBudWxsICYmIGxlZnRDaGlsZEFLZXkgPT09IHJpZ2h0Q2hpbGRCS2V5KSB7XG4gICAgICAgICAgICAgICAgX3BhdGNoT3BzMi5kZWZhdWx0Lm1vdmVDaGlsZChub2RlLCBsZWZ0Q2hpbGRBLCByaWdodENoaWxkQSwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgbGVmdENoaWxkQS5wYXRjaChyaWdodENoaWxkQiwgbm9kZSk7XG4gICAgICAgICAgICAgICAgdXBkYXRlTGVmdElkeEEgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHVwZGF0ZVJpZ2h0SWR4QiA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJpZ2h0Q2hpbGRBS2V5ICE9IG51bGwgJiYgcmlnaHRDaGlsZEFLZXkgPT09IGxlZnRDaGlsZEJLZXkpIHtcbiAgICAgICAgICAgICAgICBfcGF0Y2hPcHMyLmRlZmF1bHQubW92ZUNoaWxkKG5vZGUsIHJpZ2h0Q2hpbGRBLCBsZWZ0Q2hpbGRBLCBmYWxzZSk7XG4gICAgICAgICAgICAgICAgcmlnaHRDaGlsZEEucGF0Y2gobGVmdENoaWxkQiwgbm9kZSk7XG4gICAgICAgICAgICAgICAgdXBkYXRlUmlnaHRJZHhBID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB1cGRhdGVMZWZ0SWR4QiA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGxlZnRDaGlsZEFLZXkgIT0gbnVsbCAmJiBsZWZ0Q2hpbGRCS2V5ID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBfcGF0Y2hPcHMyLmRlZmF1bHQuaW5zZXJ0Q2hpbGQobm9kZSwgbGVmdENoaWxkQiwgbGVmdENoaWxkQSk7XG4gICAgICAgICAgICAgICAgdXBkYXRlTGVmdElkeEIgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChsZWZ0Q2hpbGRBS2V5ID09IG51bGwgJiYgbGVmdENoaWxkQktleSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgX3BhdGNoT3BzMi5kZWZhdWx0LnJlbW92ZUNoaWxkKG5vZGUsIGxlZnRDaGlsZEEpO1xuICAgICAgICAgICAgICAgIHVwZGF0ZUxlZnRJZHhBID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY2hpbGRyZW5BS2V5cyB8fCAoY2hpbGRyZW5BS2V5cyA9IGJ1aWxkS2V5cyhjaGlsZHJlbkEsIGxlZnRJZHhBLCByaWdodElkeEEpKTtcbiAgICAgICAgICAgICAgICBpZiAoKGZvdW5kQUNoaWxkSWR4ID0gY2hpbGRyZW5BS2V5c1tsZWZ0Q2hpbGRCS2V5XSkgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBmb3VuZEFDaGlsZCA9IGNoaWxkcmVuQVtmb3VuZEFDaGlsZElkeF07XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuQUluZGljZXNUb1NraXBbZm91bmRBQ2hpbGRJZHhdID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgX3BhdGNoT3BzMi5kZWZhdWx0Lm1vdmVDaGlsZChub2RlLCBmb3VuZEFDaGlsZCwgbGVmdENoaWxkQSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgICAgICBmb3VuZEFDaGlsZC5wYXRjaChsZWZ0Q2hpbGRCLCBub2RlKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBfcGF0Y2hPcHMyLmRlZmF1bHQuaW5zZXJ0Q2hpbGQobm9kZSwgbGVmdENoaWxkQiwgbGVmdENoaWxkQSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHVwZGF0ZUxlZnRJZHhCID0gdHJ1ZTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHVwZGF0ZUxlZnRJZHhBKSB7XG4gICAgICAgICAgICAgICAgdXBkYXRlTGVmdElkeEEgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBpZiAoKytsZWZ0SWR4QSA8PSByaWdodElkeEEpIHtcbiAgICAgICAgICAgICAgICAgICAgbGVmdENoaWxkQSA9IGNoaWxkcmVuQVtsZWZ0SWR4QV07XG4gICAgICAgICAgICAgICAgICAgIGxlZnRDaGlsZEFLZXkgPSBsZWZ0Q2hpbGRBLl9rZXk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodXBkYXRlUmlnaHRJZHhBKSB7XG4gICAgICAgICAgICAgICAgdXBkYXRlUmlnaHRJZHhBID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgaWYgKC0tcmlnaHRJZHhBID49IGxlZnRJZHhBKSB7XG4gICAgICAgICAgICAgICAgICAgIHJpZ2h0Q2hpbGRBID0gY2hpbGRyZW5BW3JpZ2h0SWR4QV07XG4gICAgICAgICAgICAgICAgICAgIHJpZ2h0Q2hpbGRBS2V5ID0gcmlnaHRDaGlsZEEuX2tleTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh1cGRhdGVMZWZ0SWR4Qikge1xuICAgICAgICAgICAgICAgIHVwZGF0ZUxlZnRJZHhCID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgaWYgKCsrbGVmdElkeEIgPD0gcmlnaHRJZHhCKSB7XG4gICAgICAgICAgICAgICAgICAgIGxlZnRDaGlsZEIgPSBjaGlsZHJlbkJbbGVmdElkeEJdO1xuICAgICAgICAgICAgICAgICAgICBsZWZ0Q2hpbGRCS2V5ID0gbGVmdENoaWxkQi5fa2V5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHVwZGF0ZVJpZ2h0SWR4Qikge1xuICAgICAgICAgICAgICAgIHVwZGF0ZVJpZ2h0SWR4QiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmICgtLXJpZ2h0SWR4QiA+PSBsZWZ0SWR4Qikge1xuICAgICAgICAgICAgICAgICAgICByaWdodENoaWxkQiA9IGNoaWxkcmVuQltyaWdodElkeEJdO1xuICAgICAgICAgICAgICAgICAgICByaWdodENoaWxkQktleSA9IHJpZ2h0Q2hpbGRCLl9rZXk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgd2hpbGUgKGxlZnRJZHhBIDw9IHJpZ2h0SWR4QSkge1xuICAgICAgICAgICAgaWYgKCFjaGlsZHJlbkFJbmRpY2VzVG9Ta2lwW2xlZnRJZHhBXSkge1xuICAgICAgICAgICAgICAgIF9wYXRjaE9wczIuZGVmYXVsdC5yZW1vdmVDaGlsZChub2RlLCBjaGlsZHJlbkFbbGVmdElkeEFdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgICsrbGVmdElkeEE7XG4gICAgICAgIH1cblxuICAgICAgICB3aGlsZSAobGVmdElkeEIgPD0gcmlnaHRJZHhCKSB7XG4gICAgICAgICAgICByaWdodElkeEIgPCBjaGlsZHJlbkJMZW4gLSAxID8gX3BhdGNoT3BzMi5kZWZhdWx0Lmluc2VydENoaWxkKG5vZGUsIGNoaWxkcmVuQltsZWZ0SWR4Ql0sIGNoaWxkcmVuQltyaWdodElkeEIgKyAxXSkgOiBfcGF0Y2hPcHMyLmRlZmF1bHQuYXBwZW5kQ2hpbGQobm9kZSwgY2hpbGRyZW5CW2xlZnRJZHhCXSk7XG4gICAgICAgICAgICArK2xlZnRJZHhCO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBfcGF0Y2hBdHRyczogZnVuY3Rpb24gX3BhdGNoQXR0cnMobm9kZSkge1xuICAgICAgICB2YXIgYXR0cnNBID0gdGhpcy5fYXR0cnMsXG4gICAgICAgICAgICBhdHRyc0IgPSBub2RlLl9hdHRycztcblxuICAgICAgICBpZiAoYXR0cnNBID09PSBhdHRyc0IpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBhdHRyTmFtZSA9IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGF0dHJBVmFsID0gdW5kZWZpbmVkLFxuICAgICAgICAgICAgYXR0ckJWYWwgPSB1bmRlZmluZWQsXG4gICAgICAgICAgICBpc0F0dHJBVmFsQXJyYXkgPSB1bmRlZmluZWQsXG4gICAgICAgICAgICBpc0F0dHJCVmFsQXJyYXkgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKGF0dHJzQikge1xuICAgICAgICAgICAgZm9yIChhdHRyTmFtZSBpbiBhdHRyc0IpIHtcbiAgICAgICAgICAgICAgICBhdHRyQlZhbCA9IGF0dHJzQlthdHRyTmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKCFhdHRyc0EgfHwgKGF0dHJBVmFsID0gYXR0cnNBW2F0dHJOYW1lXSkgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoYXR0ckJWYWwgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgX3BhdGNoT3BzMi5kZWZhdWx0LnVwZGF0ZUF0dHIodGhpcywgYXR0ck5hbWUsIGF0dHJCVmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0ckJWYWwgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBfcGF0Y2hPcHMyLmRlZmF1bHQucmVtb3ZlQXR0cih0aGlzLCBhdHRyTmFtZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICgodHlwZW9mIGF0dHJCVmFsID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihhdHRyQlZhbCkpID09PSAnb2JqZWN0JyAmJiAodHlwZW9mIGF0dHJBVmFsID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihhdHRyQVZhbCkpID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICBpc0F0dHJCVmFsQXJyYXkgPSBBcnJheS5pc0FycmF5KGF0dHJCVmFsKTtcbiAgICAgICAgICAgICAgICAgICAgaXNBdHRyQVZhbEFycmF5ID0gQXJyYXkuaXNBcnJheShhdHRyQVZhbCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0F0dHJCVmFsQXJyYXkgfHwgaXNBdHRyQVZhbEFycmF5KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNBdHRyQlZhbEFycmF5ICYmIGlzQXR0ckFWYWxBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3BhdGNoQXR0ckFycihhdHRyTmFtZSwgYXR0ckFWYWwsIGF0dHJCVmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgX3BhdGNoT3BzMi5kZWZhdWx0LnVwZGF0ZUF0dHIodGhpcywgYXR0ck5hbWUsIGF0dHJCVmFsKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3BhdGNoQXR0ck9iaihhdHRyTmFtZSwgYXR0ckFWYWwsIGF0dHJCVmFsKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoYXR0ckFWYWwgIT09IGF0dHJCVmFsKSB7XG4gICAgICAgICAgICAgICAgICAgIF9wYXRjaE9wczIuZGVmYXVsdC51cGRhdGVBdHRyKHRoaXMsIGF0dHJOYW1lLCBhdHRyQlZhbCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0dHJzQSkge1xuICAgICAgICAgICAgZm9yIChhdHRyTmFtZSBpbiBhdHRyc0EpIHtcbiAgICAgICAgICAgICAgICBpZiAoKCFhdHRyc0IgfHwgIShhdHRyTmFtZSBpbiBhdHRyc0IpKSAmJiAoYXR0ckFWYWwgPSBhdHRyc0FbYXR0ck5hbWVdKSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIF9wYXRjaE9wczIuZGVmYXVsdC5yZW1vdmVBdHRyKHRoaXMsIGF0dHJOYW1lKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIF9wYXRjaEF0dHJBcnI6IGZ1bmN0aW9uIF9wYXRjaEF0dHJBcnIoYXR0ck5hbWUsIGFyckEsIGFyckIpIHtcbiAgICAgICAgaWYgKGFyckEgPT09IGFyckIpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBsZW5BID0gYXJyQS5sZW5ndGg7XG4gICAgICAgIHZhciBoYXNEaWZmID0gZmFsc2U7XG5cbiAgICAgICAgaWYgKGxlbkEgIT09IGFyckIubGVuZ3RoKSB7XG4gICAgICAgICAgICBoYXNEaWZmID0gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgICAgIHdoaWxlICghaGFzRGlmZiAmJiBpIDwgbGVuQSkge1xuICAgICAgICAgICAgICAgIGlmIChhcnJBW2ldICE9IGFyckJbaV0pIHtcbiAgICAgICAgICAgICAgICAgICAgaGFzRGlmZiA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICsraTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGhhc0RpZmYgJiYgX3BhdGNoT3BzMi5kZWZhdWx0LnVwZGF0ZUF0dHIodGhpcywgYXR0ck5hbWUsIGFyckIpO1xuICAgIH0sXG4gICAgX3BhdGNoQXR0ck9iajogZnVuY3Rpb24gX3BhdGNoQXR0ck9iaihhdHRyTmFtZSwgb2JqQSwgb2JqQikge1xuICAgICAgICBpZiAob2JqQSA9PT0gb2JqQikge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGhhc0RpZmYgPSBmYWxzZSxcbiAgICAgICAgICAgIGRpZmZPYmogPSB7fTtcblxuICAgICAgICBmb3IgKHZhciBpIGluIG9iakIpIHtcbiAgICAgICAgICAgIGlmIChvYmpBW2ldICE9IG9iakJbaV0pIHtcbiAgICAgICAgICAgICAgICBoYXNEaWZmID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBkaWZmT2JqW2ldID0gb2JqQltpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGkgaW4gb2JqQSkge1xuICAgICAgICAgICAgaWYgKG9iakFbaV0gIT0gbnVsbCAmJiAhKGkgaW4gb2JqQikpIHtcbiAgICAgICAgICAgICAgICBoYXNEaWZmID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBkaWZmT2JqW2ldID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGhhc0RpZmYgJiYgX3BhdGNoT3BzMi5kZWZhdWx0LnVwZGF0ZUF0dHIodGhpcywgYXR0ck5hbWUsIGRpZmZPYmopO1xuICAgIH1cbn07XG5cbmZ1bmN0aW9uIHByb2Nlc3NDaGlsZHJlbihjaGlsZHJlbikge1xuICAgIGlmIChjaGlsZHJlbiA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHZhciB0eXBlT2ZDaGlsZHJlbiA9IHR5cGVvZiBjaGlsZHJlbiA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YoY2hpbGRyZW4pO1xuXG4gICAgaWYgKHR5cGVPZkNoaWxkcmVuID09PSAnb2JqZWN0Jykge1xuICAgICAgICB2YXIgcmVzID0gQXJyYXkuaXNBcnJheShjaGlsZHJlbikgPyBjaGlsZHJlbiA6IFtjaGlsZHJlbl07XG5cbiAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgICAgIGNoZWNrQ2hpbGRyZW4ocmVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiByZXM7XG4gICAgfVxuXG4gICAgcmV0dXJuIHR5cGVPZkNoaWxkcmVuID09PSAnc3RyaW5nJyA/IGNoaWxkcmVuIDogY2hpbGRyZW4udG9TdHJpbmcoKTtcbn1cblxuZnVuY3Rpb24gY2hlY2tDaGlsZHJlbihjaGlsZHJlbikge1xuICAgIHZhciBrZXlzID0ge30sXG4gICAgICAgIGxlbiA9IGNoaWxkcmVuLmxlbmd0aDtcblxuICAgIHZhciBpID0gMCxcbiAgICAgICAgY2hpbGQgPSB1bmRlZmluZWQ7XG5cbiAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgICBjaGlsZCA9IGNoaWxkcmVuW2krK107XG5cbiAgICAgICAgaWYgKCh0eXBlb2YgY2hpbGQgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKGNoaWxkKSkgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBfY29uc29sZTIuZGVmYXVsdC5lcnJvcignWW91IG11c3RuXFwndCB1c2Ugc2ltcGxlIGNoaWxkIGluIGNhc2Ugb2YgbXVsdGlwbGUgY2hpbGRyZW4uJyk7XG4gICAgICAgIH0gZWxzZSBpZiAoY2hpbGQuX2tleSAhPSBudWxsKSB7XG4gICAgICAgICAgICBpZiAoY2hpbGQuX2tleSBpbiBrZXlzKSB7XG4gICAgICAgICAgICAgICAgX2NvbnNvbGUyLmRlZmF1bHQuZXJyb3IoJ0NoaWxkcmVuc1xcJyBrZXlzIG11c3QgYmUgdW5pcXVlIGFjcm9zcyB0aGUgY2hpbGRyZW4uIEZvdW5kIGR1cGxpY2F0ZSBvZiBcIicgKyBjaGlsZC5fa2V5ICsgJ1wiIGtleS4nKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAga2V5c1tjaGlsZC5fa2V5XSA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGJ1aWxkS2V5cyhjaGlsZHJlbiwgaWR4RnJvbSwgaWR4VG8pIHtcbiAgICB2YXIgcmVzID0ge30sXG4gICAgICAgIGNoaWxkID0gdW5kZWZpbmVkO1xuXG4gICAgd2hpbGUgKGlkeEZyb20gPCBpZHhUbykge1xuICAgICAgICBjaGlsZCA9IGNoaWxkcmVuW2lkeEZyb21dO1xuICAgICAgICBjaGlsZC5fa2V5ICE9IG51bGwgJiYgKHJlc1tjaGlsZC5fa2V5XSA9IGlkeEZyb20pO1xuICAgICAgICArK2lkeEZyb207XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcztcbn1cblxuZnVuY3Rpb24gY2hlY2tBdHRycyhhdHRycykge1xuICAgIGZvciAodmFyIG5hbWUgaW4gYXR0cnMpIHtcbiAgICAgICAgaWYgKG5hbWUuc3Vic3RyKDAsIDIpID09PSAnb24nICYmICFfYXR0cnNUb0V2ZW50czIuZGVmYXVsdFtuYW1lXSkge1xuICAgICAgICAgICAgX2NvbnNvbGUyLmRlZmF1bHQuZXJyb3IoJ1lvdVxcJ3JlIHRyeWluZyB0byBhZGQgdW5zdXBwb3J0ZWQgZXZlbnQgbGlzdGVuZXIgXCInICsgbmFtZSArICdcIi4nKTtcbiAgICAgICAgfVxuICAgIH1cbn0iLCJcInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKHRyZWUpIHtcbiAgcmV0dXJuIHRyZWUucmVuZGVyVG9TdHJpbmcoKTtcbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG5cbnZhciBfbm9PcCA9IHJlcXVpcmUoJy4vbm9PcCcpO1xuXG52YXIgX25vT3AyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfbm9PcCk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbnZhciBnbG9iYWxDb25zb2xlID0gZ2xvYmFsLmNvbnNvbGUsXG4gICAgY29uc29sZSA9IHt9LFxuICAgIFBSRUZJWEVTID0ge1xuICAgIGxvZzogJycsXG4gICAgaW5mbzogJycsXG4gICAgd2FybjogJ1dhcm5pbmchJyxcbiAgICBlcnJvcjogJ0Vycm9yISdcbn07XG5cblsnbG9nJywgJ2luZm8nLCAnd2FybicsICdlcnJvciddLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcbiAgICBjb25zb2xlW25hbWVdID0gZ2xvYmFsQ29uc29sZSA/IGdsb2JhbENvbnNvbGVbbmFtZV0gPyBmdW5jdGlvbiAoYXJnMSwgYXJnMiwgYXJnMywgYXJnNCwgYXJnNSkge1xuICAgICAgICAvLyBJRTk6IGNvbnNvbGUgbWV0aG9kcyBhcmVuJ3QgZnVuY3Rpb25zXG4gICAgICAgIHZhciBhcmcwID0gUFJFRklYRVNbbmFtZV07XG4gICAgICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICAgICAgIGdsb2JhbENvbnNvbGVbbmFtZV0oYXJnMCwgYXJnMSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgMjpcbiAgICAgICAgICAgICAgICBnbG9iYWxDb25zb2xlW25hbWVdKGFyZzAsIGFyZzEsIGFyZzIpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIDM6XG4gICAgICAgICAgICAgICAgZ2xvYmFsQ29uc29sZVtuYW1lXShhcmcwLCBhcmcxLCBhcmcyLCBhcmczKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSA0OlxuICAgICAgICAgICAgICAgIGdsb2JhbENvbnNvbGVbbmFtZV0oYXJnMCwgYXJnMSwgYXJnMiwgYXJnMywgYXJnNCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgNTpcbiAgICAgICAgICAgICAgICBnbG9iYWxDb25zb2xlW25hbWVdKGFyZzAsIGFyZzEsIGFyZzIsIGFyZzMsIGFyZzQsIGFyZzUpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfSA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZ2xvYmFsQ29uc29sZS5sb2cuYXBwbHkoZ2xvYmFsQ29uc29sZSwgYXJndW1lbnRzKTtcbiAgICB9IDogX25vT3AyLmRlZmF1bHQ7XG59KTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gY29uc29sZTsiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG52YXIgREFTSEVSSVpFX1JFID0gLyhbXkEtWl0rKShbQS1aXSkvZztcblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKHN0cikge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoREFTSEVSSVpFX1JFLCAnJDEtJDInKS50b0xvd2VyQ2FzZSgpO1xufTsiLCJcInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuZGVmYXVsdCA9IHt9OyIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBmdW5jdGlvbiAoc3RyKSB7XG4gICAgcmV0dXJuIChzdHIgKyAnJykucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7Jyk7XG59OyIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBmdW5jdGlvbiAoc3RyKSB7XG4gICAgcmV0dXJuIChzdHIgKyAnJykucmVwbGFjZSgvJi9nLCAnJmFtcDsnKS5yZXBsYWNlKC88L2csICcmbHQ7JykucmVwbGFjZSgvPi9nLCAnJmd0OycpO1xufTsiLCJcInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBmdW5jdGlvbiAoYXJyLCBpdGVtKSB7XG4gICAgdmFyIGxlbiA9IGFyci5sZW5ndGg7XG4gICAgdmFyIGkgPSAwO1xuXG4gICAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICAgICAgaWYgKGFycltpKytdID09IGl0ZW0pIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xufTsiLCJcInVzZSBzdHJpY3RcIjtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKCkge307IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3R5cGVvZiA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgU3ltYm9sLml0ZXJhdG9yID09PSBcInN5bWJvbFwiID8gZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gdHlwZW9mIG9iajsgfSA6IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIG9iaiAmJiB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb2JqLmNvbnN0cnVjdG9yID09PSBTeW1ib2wgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajsgfTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBmdW5jdGlvbiAoY2hpbGRyZW4pIHtcbiAgICB2YXIgcmVzID0gbm9ybWFsaXplQ2hpbGRyZW4oY2hpbGRyZW4pO1xuXG4gICAgaWYgKHJlcyAhPT0gbnVsbCAmJiAodHlwZW9mIHJlcyA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YocmVzKSkgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHJlcykpIHtcbiAgICAgICAgcmVzID0gW3Jlc107XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcztcbn07XG5cbnZhciBfY3JlYXRlTm9kZSA9IHJlcXVpcmUoJy4uL2NyZWF0ZU5vZGUnKTtcblxudmFyIF9jcmVhdGVOb2RlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2NyZWF0ZU5vZGUpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG5mdW5jdGlvbiBub3JtYWxpemVDaGlsZHJlbihjaGlsZHJlbikge1xuICAgIGlmIChjaGlsZHJlbiA9PSBudWxsKSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHZhciB0eXBlT2ZDaGlsZHJlbiA9IHR5cGVvZiBjaGlsZHJlbiA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YoY2hpbGRyZW4pO1xuICAgIGlmICh0eXBlT2ZDaGlsZHJlbiAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgcmV0dXJuIHR5cGVPZkNoaWxkcmVuID09PSAnc3RyaW5nJyA/IGNoaWxkcmVuIDogY2hpbGRyZW4udG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICBpZiAoIUFycmF5LmlzQXJyYXkoY2hpbGRyZW4pKSB7XG4gICAgICAgIHJldHVybiBjaGlsZHJlbjtcbiAgICB9XG5cbiAgICBpZiAoIWNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgcmVzID0gY2hpbGRyZW4sXG4gICAgICAgIGkgPSAwLFxuICAgICAgICBsZW4gPSBjaGlsZHJlbi5sZW5ndGgsXG4gICAgICAgIGFsbFNraXBwZWQgPSB0cnVlLFxuICAgICAgICBjaGlsZCA9IHVuZGVmaW5lZCxcbiAgICAgICAgaXNDaGlsZE9iamVjdCA9IHVuZGVmaW5lZDtcblxuICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICAgIGNoaWxkID0gbm9ybWFsaXplQ2hpbGRyZW4oY2hpbGRyZW5baV0pO1xuICAgICAgICBpZiAoY2hpbGQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChyZXMgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBpZiAoYWxsU2tpcHBlZCkge1xuICAgICAgICAgICAgICAgICAgICByZXMgPSBudWxsO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAocmVzID09PSBjaGlsZHJlbikge1xuICAgICAgICAgICAgICAgICAgICByZXMgPSBjaGlsZHJlbi5zbGljZSgwLCBpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAocmVzID09PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgcmVzID0gY2hpbGQ7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoY2hpbGQpKSB7XG4gICAgICAgICAgICAgICAgcmVzID0gYWxsU2tpcHBlZCA/IGNoaWxkIDogKHJlcyA9PT0gY2hpbGRyZW4gPyByZXMuc2xpY2UoMCwgaSkgOiBBcnJheS5pc0FycmF5KHJlcykgPyByZXMgOiBbcmVzXSkuY29uY2F0KGNoaWxkKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaXNDaGlsZE9iamVjdCA9ICh0eXBlb2YgY2hpbGQgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKGNoaWxkKSkgPT09ICdvYmplY3QnO1xuXG4gICAgICAgICAgICAgICAgaWYgKGlzQ2hpbGRPYmplY3QgJiYgY2hpbGRyZW5baV0gPT09IGNoaWxkKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXMgIT09IGNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMgPSBqb2luKHJlcywgY2hpbGQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlcyA9PT0gY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhbGxTa2lwcGVkICYmIGlzQ2hpbGRPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXMgPSBjaGlsZDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICArK2k7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcyA9IHJlcy5zbGljZSgwLCBpKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJlcyA9IGpvaW4ocmVzLCBjaGlsZCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBhbGxTa2lwcGVkID0gZmFsc2U7XG4gICAgICAgIH1cblxuICAgICAgICArK2k7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlcztcbn1cblxuZnVuY3Rpb24gdG9Ob2RlKG9iaikge1xuICAgIHJldHVybiAodHlwZW9mIG9iaiA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2Yob2JqKSkgPT09ICdvYmplY3QnID8gb2JqIDogKDAsIF9jcmVhdGVOb2RlMi5kZWZhdWx0KSgnc3BhbicpLmNoaWxkcmVuKG9iaik7XG59XG5cbmZ1bmN0aW9uIGpvaW4ob2JqQSwgb2JqQikge1xuICAgIGlmIChBcnJheS5pc0FycmF5KG9iakEpKSB7XG4gICAgICAgIG9iakEucHVzaCh0b05vZGUob2JqQikpO1xuICAgICAgICByZXR1cm4gb2JqQTtcbiAgICB9XG5cbiAgICByZXR1cm4gW3RvTm9kZShvYmpBKSwgdG9Ob2RlKG9iakIpXTtcbn0iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuQ29tcG9uZW50ID0gZXhwb3J0cy5ub3JtYWxpemVDaGlsZHJlbiA9IGV4cG9ydHMucmVuZGVyVG9TdHJpbmcgPSBleHBvcnRzLmNyZWF0ZUNvbXBvbmVudCA9IGV4cG9ydHMubm9kZSA9IGV4cG9ydHMudW5tb3VudEZyb21Eb21TeW5jID0gZXhwb3J0cy51bm1vdW50RnJvbURvbSA9IGV4cG9ydHMubW91bnRUb0RvbVN5bmMgPSBleHBvcnRzLm1vdW50VG9Eb20gPSB1bmRlZmluZWQ7XG5cbnZhciBfbW91bnRlciA9IHJlcXVpcmUoJy4vY2xpZW50L21vdW50ZXInKTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdtb3VudFRvRG9tJywge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgIHJldHVybiBfbW91bnRlci5tb3VudFRvRG9tO1xuICAgIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdtb3VudFRvRG9tU3luYycsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICByZXR1cm4gX21vdW50ZXIubW91bnRUb0RvbVN5bmM7XG4gICAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ3VubW91bnRGcm9tRG9tJywge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgIHJldHVybiBfbW91bnRlci51bm1vdW50RnJvbURvbTtcbiAgICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAndW5tb3VudEZyb21Eb21TeW5jJywge1xuICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICAgIHJldHVybiBfbW91bnRlci51bm1vdW50RnJvbURvbVN5bmM7XG4gICAgfVxufSk7XG5cbnZhciBfY3JlYXRlTm9kZSA9IHJlcXVpcmUoJy4vY3JlYXRlTm9kZScpO1xuXG52YXIgX2NyZWF0ZU5vZGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY3JlYXRlTm9kZSk7XG5cbnZhciBfY3JlYXRlQ29tcG9uZW50ID0gcmVxdWlyZSgnLi9jcmVhdGVDb21wb25lbnQnKTtcblxudmFyIF9jcmVhdGVDb21wb25lbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY3JlYXRlQ29tcG9uZW50KTtcblxudmFyIF9yZW5kZXJUb1N0cmluZyA9IHJlcXVpcmUoJy4vcmVuZGVyVG9TdHJpbmcnKTtcblxudmFyIF9yZW5kZXJUb1N0cmluZzIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9yZW5kZXJUb1N0cmluZyk7XG5cbnZhciBfbm9ybWFsaXplQ2hpbGRyZW4gPSByZXF1aXJlKCcuL3V0aWxzL25vcm1hbGl6ZUNoaWxkcmVuJyk7XG5cbnZhciBfbm9ybWFsaXplQ2hpbGRyZW4yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfbm9ybWFsaXplQ2hpbGRyZW4pO1xuXG52YXIgX0NvbXBvbmVudCA9IHJlcXVpcmUoJy4vQ29tcG9uZW50Jyk7XG5cbnZhciBfQ29tcG9uZW50MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX0NvbXBvbmVudCk7XG5cbnZhciBfY29uc29sZSA9IHJlcXVpcmUoJy4vdXRpbHMvY29uc29sZScpO1xuXG52YXIgX2NvbnNvbGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY29uc29sZSk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgX2NvbnNvbGUyLmRlZmF1bHQuaW5mbygnWW91XFwncmUgdXNpbmcgZGV2IHZlcnNpb24gb2YgVmlkb20nKTtcbn1cblxuLy8gVE9ETzogdGFrZSBiYWNrIGFmdGVyIGh0dHBzOi8vcGhhYnJpY2F0b3IuYmFiZWxqcy5pby9UNjc4NlxuLy8gZXhwb3J0ICogZnJvbSAnLi9jbGllbnQvbW91bnRlcic7XG5leHBvcnRzLm5vZGUgPSBfY3JlYXRlTm9kZTIuZGVmYXVsdDtcbmV4cG9ydHMuY3JlYXRlQ29tcG9uZW50ID0gX2NyZWF0ZUNvbXBvbmVudDIuZGVmYXVsdDtcbmV4cG9ydHMucmVuZGVyVG9TdHJpbmcgPSBfcmVuZGVyVG9TdHJpbmcyLmRlZmF1bHQ7XG5leHBvcnRzLm5vcm1hbGl6ZUNoaWxkcmVuID0gX25vcm1hbGl6ZUNoaWxkcmVuMi5kZWZhdWx0O1xuZXhwb3J0cy5Db21wb25lbnQgPSBfQ29tcG9uZW50Mi5kZWZhdWx0OyIsImltcG9ydCBDbGlwYm9hcmQgZnJvbSBcImNsaXBib2FyZFwiXG5pbXBvcnQgeyBub2RlICwgQ29tcG9uZW50LCBtb3VudFRvRG9tIH0gZnJvbSAndmlkb20vbGliL3ZpZG9tJztcbmltcG9ydCBkb2NSZWFkeSBmcm9tIFwiZG9jLXJlYWR5XCJcblxuY2xhc3MgQXBwIGV4dGVuZHMgQ29tcG9uZW50e1xuICBvblJlbmRlcigpe1xuICAgIHJldHVybiBub2RlKFwiZGl2XCIpLmNoaWxkcmVuKFwiaGVsbG9cIilcbiAgfVxufVxuXG5kb2NSZWFkeSggZnVuY3Rpb24oKXtcbiAgbGV0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdjb250YWluZXInKVxuICBtb3VudFRvRG9tKGNvbnRhaW5lciwgbm9kZShBcHApKTtcbn0pXG4iXX0=

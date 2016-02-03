(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (factory());
}(this, function () { 'use strict';

  var babelHelpers = {};
  babelHelpers.typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };
  babelHelpers;


  var __commonjs_global = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this;
  function __commonjs(fn, module) { return module = { exports: {} }, fn(module, module.exports, __commonjs_global), module.exports; }

  var index$2 = __commonjs(function (module) {
  /**
   * Element prototype.
   */

  var proto = Element.prototype;

  /**
   * Vendor function.
   */

  var vendor = proto.matchesSelector || proto.webkitMatchesSelector || proto.mozMatchesSelector || proto.msMatchesSelector || proto.oMatchesSelector;

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
  });

  var require$$0$11 = (index$2 && typeof index$2 === 'object' && 'default' in index$2 ? index$2['default'] : index$2);

  var index$1 = __commonjs(function (module) {
  var matches = require$$0$11;

  module.exports = function (element, selector, checkYoSelf) {
    var parent = checkYoSelf ? element : element.parentNode;

    while (parent && parent !== document) {
      if (matches(parent, selector)) return parent;
      parent = parent.parentNode;
    }
  };
  });

  var require$$0$10 = (index$1 && typeof index$1 === 'object' && 'default' in index$1 ? index$1['default'] : index$1);

  var delegate = __commonjs(function (module) {
  var closest = require$$0$10;

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
          destroy: function destroy() {
              element.removeEventListener(type, listenerFn, useCapture);
          }
      };
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
      return function (e) {
          e.delegateTarget = closest(e.target, selector, true);

          if (e.delegateTarget) {
              callback.call(element, e);
          }
      };
  }

  module.exports = delegate;
  });

  var require$$0$9 = (delegate && typeof delegate === 'object' && 'default' in delegate ? delegate['default'] : delegate);

  var is = __commonjs(function (module, exports) {
  /**
   * Check if argument is a HTML element.
   *
   * @param {Object} value
   * @return {Boolean}
   */
  exports.node = function (value) {
    return value !== undefined && value instanceof HTMLElement && value.nodeType === 1;
  };

  /**
   * Check if argument is a list of HTML elements.
   *
   * @param {Object} value
   * @return {Boolean}
   */
  exports.nodeList = function (value) {
    var type = Object.prototype.toString.call(value);

    return value !== undefined && (type === '[object NodeList]' || type === '[object HTMLCollection]') && 'length' in value && (value.length === 0 || exports.node(value[0]));
  };

  /**
   * Check if argument is a string.
   *
   * @param {Object} value
   * @return {Boolean}
   */
  exports.string = function (value) {
    return typeof value === 'string' || value instanceof String;
  };

  /**
   * Check if argument is a function.
   *
   * @param {Object} value
   * @return {Boolean}
   */
  exports.fn = function (value) {
    var type = Object.prototype.toString.call(value);

    return type === '[object Function]';
  };
  });

  var require$$1$5 = (is && typeof is === 'object' && 'default' in is ? is['default'] : is);

  var listen = __commonjs(function (module) {
  var is = require$$1$5;
  var delegate = require$$0$9;

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
      } else if (is.nodeList(target)) {
          return listenNodeList(target, type, callback);
      } else if (is.string(target)) {
          return listenSelector(target, type, callback);
      } else {
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
          destroy: function destroy() {
              node.removeEventListener(type, callback);
          }
      };
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
      Array.prototype.forEach.call(nodeList, function (node) {
          node.addEventListener(type, callback);
      });

      return {
          destroy: function destroy() {
              Array.prototype.forEach.call(nodeList, function (node) {
                  node.removeEventListener(type, callback);
              });
          }
      };
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
  });

  var require$$0$2 = (listen && typeof listen === 'object' && 'default' in listen ? listen['default'] : listen);

  var index = __commonjs(function (module) {
  function E() {
    // Keep this empty so it's easier to inherit from
    // (via https://github.com/lipsmack from https://github.com/scottcorgan/tiny-emitter/issues/3)
  }

  E.prototype = {
    on: function on(name, callback, ctx) {
      var e = this.e || (this.e = {});

      (e[name] || (e[name] = [])).push({
        fn: callback,
        ctx: ctx
      });

      return this;
    },

    once: function once(name, callback, ctx) {
      var self = this;
      function listener() {
        self.off(name, listener);
        callback.apply(ctx, arguments);
      };

      listener._ = callback;
      return this.on(name, listener, ctx);
    },

    emit: function emit(name) {
      var data = [].slice.call(arguments, 1);
      var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
      var i = 0;
      var len = evtArr.length;

      for (i; i < len; i++) {
        evtArr[i].fn.apply(evtArr[i].ctx, data);
      }

      return this;
    },

    off: function off(name, callback) {
      var e = this.e || (this.e = {});
      var evts = e[name];
      var liveEvents = [];

      if (evts && callback) {
        for (var i = 0, len = evts.length; i < len; i++) {
          if (evts[i].fn !== callback && evts[i].fn._ !== callback) liveEvents.push(evts[i]);
        }
      }

      // Remove event from queue to prevent memory leak
      // Suggested by https://github.com/lazd
      // Ref: https://github.com/scottcorgan/tiny-emitter/commit/c6ebfaa9bc973b33d110a84a307742b7cf94c953#commitcomment-5024910

      liveEvents.length ? e[name] = liveEvents : delete e[name];

      return this;
    }
  };

  module.exports = E;
  });

  var require$$1$1 = (index && typeof index === 'object' && 'default' in index ? index['default'] : index);

  var select = __commonjs(function (module) {
  function select(element) {
      var selectedText;

      if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA') {
          element.focus();
          element.setSelectionRange(0, element.value.length);

          selectedText = element.value;
      } else {
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
  });

  var require$$0$7 = (select && typeof select === 'object' && 'default' in select ? select['default'] : select);

  var clipboardAction = __commonjs(function (module, exports) {
  'use strict';

  exports.__esModule = true;

  var _createClass = function () {
      function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
              var descriptor = props[i];descriptor.enumerable = descriptor.enumerable || false;descriptor.configurable = true;if ('value' in descriptor) descriptor.writable = true;Object.defineProperty(target, descriptor.key, descriptor);
          }
      }return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);if (staticProps) defineProperties(Constructor, staticProps);return Constructor;
      };
  }();

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { 'default': obj };
  }

  function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
          throw new TypeError('Cannot call a class as a function');
      }
  }

  var _select = require$$0$7;

  var _select2 = _interopRequireDefault(_select);

  /**
   * Inner class which performs selection from either `text` or `target`
   * properties and then executes copy or cut operations.
   */

  var ClipboardAction = function () {
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
                  if (target && (typeof target === 'undefined' ? 'undefined' : babelHelpers.typeof(target)) === 'object' && target.nodeType === 1) {
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
  }();

  exports['default'] = ClipboardAction;
  module.exports = exports['default'];
  });

  var require$$2 = (clipboardAction && typeof clipboardAction === 'object' && 'default' in clipboardAction ? clipboardAction['default'] : clipboardAction);

  var clipboard = __commonjs(function (module, exports) {
  'use strict';

  exports.__esModule = true;

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { 'default': obj };
  }

  function _classCallCheck(instance, Constructor) {
      if (!(instance instanceof Constructor)) {
          throw new TypeError('Cannot call a class as a function');
      }
  }

  function _inherits(subClass, superClass) {
      if (typeof superClass !== 'function' && superClass !== null) {
          throw new TypeError('Super expression must either be null or a function, not ' + (typeof superClass === 'undefined' ? 'undefined' : babelHelpers.typeof(superClass)));
      }subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } });if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
  }

  var _clipboardAction = require$$2;

  var _clipboardAction2 = _interopRequireDefault(_clipboardAction);

  var _tinyEmitter = require$$1$1;

  var _tinyEmitter2 = _interopRequireDefault(_tinyEmitter);

  var _goodListener = require$$0$2;

  var _goodListener2 = _interopRequireDefault(_goodListener);

  /**
   * Base class which takes one or more elements, adds event listeners to them,
   * and instantiates a new `ClipboardAction` on each click.
   */

  var Clipboard = function (_Emitter) {
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
  }(_tinyEmitter2['default']);

  function getAttributeValue(suffix, element) {
      var attribute = 'data-clipboard-' + suffix;

      if (!element.hasAttribute(attribute)) {
          return;
      }

      return element.getAttribute(attribute);
  }

  exports['default'] = Clipboard;
  module.exports = exports['default'];
  });

  var noOp = __commonjs(function (module, exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  exports.default = function () {};
  });

  var require$$0$4 = (noOp && typeof noOp === 'object' && 'default' in noOp ? noOp['default'] : noOp);

  var console$1 = __commonjs(function (module, exports, global) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
      value: true
  });

  var _noOp = require$$0$4;

  var _noOp2 = _interopRequireDefault(_noOp);

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

  var require$$0$1 = (console$1 && typeof console$1 === 'object' && 'default' in console$1 ? console$1['default'] : console$1);

  var emptyObj = __commonjs(function (module, exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.default = {};
  });

  var require$$5 = (emptyObj && typeof emptyObj === 'object' && 'default' in emptyObj ? emptyObj['default'] : emptyObj);

  var rafBatch = __commonjs(function (module, exports, global) {
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
  });

  var require$$0$3 = (rafBatch && typeof rafBatch === 'object' && 'default' in rafBatch ? rafBatch['default'] : rafBatch);

  var FunctionComponentNode = __commonjs(function (module, exports) {
  'use strict';

  var _typeof = typeof Symbol === "function" && babelHelpers.typeof(Symbol.iterator) === "symbol" ? function (obj) {
      return typeof obj === "undefined" ? "undefined" : babelHelpers.typeof(obj);
  } : function (obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj === "undefined" ? "undefined" : babelHelpers.typeof(obj);
  };

  Object.defineProperty(exports, "__esModule", {
      value: true
  });
  exports.default = FunctionComponentNode;

  var _TagNode = require$$1$4;

  var _TagNode2 = _interopRequireDefault(_TagNode);

  var _emptyObj = require$$5;

  var _emptyObj2 = _interopRequireDefault(_emptyObj);

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

  var require$$0$5 = (FunctionComponentNode && typeof FunctionComponentNode === 'object' && 'default' in FunctionComponentNode ? FunctionComponentNode['default'] : FunctionComponentNode);

  var ComponentNode = __commonjs(function (module, exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
      value: true
  });
  exports.default = ComponentNode;

  var _emptyObj = require$$5;

  var _emptyObj2 = _interopRequireDefault(_emptyObj);

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

  var require$$1$3 = (ComponentNode && typeof ComponentNode === 'object' && 'default' in ComponentNode ? ComponentNode['default'] : ComponentNode);

  var createElementByHtml = __commonjs(function (module, exports, global) {
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
  });

  var require$$2$6 = (createElementByHtml && typeof createElementByHtml === 'object' && 'default' in createElementByHtml ? createElementByHtml['default'] : createElementByHtml);

  var createElement = __commonjs(function (module, exports, global) {
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
  });

  var require$$3$2 = (createElement && typeof createElement === 'object' && 'default' in createElement ? createElement['default'] : createElement);

  var browsers = __commonjs(function (module, exports, global) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  var ua = global.navigator ? global.navigator.userAgent : '';

  var isTrident = exports.isTrident = ua.indexOf('Trident') > -1;
  var isEdge = exports.isEdge = ua.indexOf('Edge') > -1;
  });

  var require$$4 = (browsers && typeof browsers === 'object' && 'default' in browsers ? browsers['default'] : browsers);

  var isInArray = __commonjs(function (module, exports) {
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
  });

  var require$$2$4 = (isInArray && typeof isInArray === 'object' && 'default' in isInArray ? isInArray['default'] : isInArray);

  var escapeHtml = __commonjs(function (module, exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
      value: true
  });

  exports.default = function (str) {
      return (str + '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  });

  var require$$8 = (escapeHtml && typeof escapeHtml === 'object' && 'default' in escapeHtml ? escapeHtml['default'] : escapeHtml);

  var attrsToEvents = __commonjs(function (module, exports) {
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
  });

  var require$$0$8 = (attrsToEvents && typeof attrsToEvents === 'object' && 'default' in attrsToEvents ? attrsToEvents['default'] : attrsToEvents);

  var getDomNodeId = __commonjs(function (module, exports) {
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
  });

  var require$$0$6 = (getDomNodeId && typeof getDomNodeId === 'object' && 'default' in getDomNodeId ? getDomNodeId['default'] : getDomNodeId);

  var SyntheticEvent = __commonjs(function (module, exports) {
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
  });

  var require$$1$8 = (SyntheticEvent && typeof SyntheticEvent === 'object' && 'default' in SyntheticEvent ? SyntheticEvent['default'] : SyntheticEvent);

  var isEventSupported = __commonjs(function (module, exports, global) {
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
  });

  var require$$2$7 = (isEventSupported && typeof isEventSupported === 'object' && 'default' in isEventSupported ? isEventSupported['default'] : isEventSupported);

  var domEventManager = __commonjs(function (module, exports, global) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
      value: true
  });
  exports.removeListeners = exports.removeListener = exports.addListener = undefined;

  var _isEventSupported = require$$2$7;

  var _isEventSupported2 = _interopRequireDefault(_isEventSupported);

  var _SyntheticEvent = require$$1$8;

  var _SyntheticEvent2 = _interopRequireDefault(_SyntheticEvent);

  var _getDomNodeId = require$$0$6;

  var _getDomNodeId2 = _interopRequireDefault(_getDomNodeId);

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

  var require$$1$6 = (domEventManager && typeof domEventManager === 'object' && 'default' in domEventManager ? domEventManager['default'] : domEventManager);

  var dasherize = __commonjs(function (module, exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  var DASHERIZE_RE = /([^A-Z]+)([A-Z])/g;

  exports.default = function (str) {
    return str.replace(DASHERIZE_RE, '$1-$2').toLowerCase();
  };
  });

  var require$$1$7 = (dasherize && typeof dasherize === 'object' && 'default' in dasherize ? dasherize['default'] : dasherize);

  var escapeAttr = __commonjs(function (module, exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
      value: true
  });

  exports.default = function (str) {
      return (str + '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  };
  });

  var require$$3$3 = (escapeAttr && typeof escapeAttr === 'object' && 'default' in escapeAttr ? escapeAttr['default'] : escapeAttr);

  var domAttrs = __commonjs(function (module, exports, global) {
  'use strict';

  var _typeof = typeof Symbol === "function" && babelHelpers.typeof(Symbol.iterator) === "symbol" ? function (obj) {
      return typeof obj === "undefined" ? "undefined" : babelHelpers.typeof(obj);
  } : function (obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj === "undefined" ? "undefined" : babelHelpers.typeof(obj);
  };

  Object.defineProperty(exports, "__esModule", {
      value: true
  });

  exports.default = function (attrName) {
      return attrsCfg[attrName] || DEFAULT_ATTR_CFG;
  };

  var _escapeAttr = require$$3$3;

  var _escapeAttr2 = _interopRequireDefault(_escapeAttr);

  var _isInArray = require$$2$4;

  var _isInArray2 = _interopRequireDefault(_isInArray);

  var _dasherize = require$$1$7;

  var _dasherize2 = _interopRequireDefault(_dasherize);

  var _console = require$$0$1;

  var _console2 = _interopRequireDefault(_console);

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

  var require$$2$5 = (domAttrs && typeof domAttrs === 'object' && 'default' in domAttrs ? domAttrs['default'] : domAttrs);

  var patchOps = __commonjs(function (module, exports, global) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
      value: true
  });

  var _domAttrs = require$$2$5;

  var _domAttrs2 = _interopRequireDefault(_domAttrs);

  var _domEventManager = require$$1$6;

  var _attrsToEvents = require$$0$8;

  var _attrsToEvents2 = _interopRequireDefault(_attrsToEvents);

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

  var require$$12 = (patchOps && typeof patchOps === 'object' && 'default' in patchOps ? patchOps['default'] : patchOps);

  var TagNode = __commonjs(function (module, exports) {
  'use strict';

  var _typeof = typeof Symbol === "function" && babelHelpers.typeof(Symbol.iterator) === "symbol" ? function (obj) {
      return typeof obj === "undefined" ? "undefined" : babelHelpers.typeof(obj);
  } : function (obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj === "undefined" ? "undefined" : babelHelpers.typeof(obj);
  };

  Object.defineProperty(exports, "__esModule", {
      value: true
  });
  exports.default = TagNode;

  var _patchOps = require$$12;

  var _patchOps2 = _interopRequireDefault(_patchOps);

  var _domAttrs = require$$2$5;

  var _domAttrs2 = _interopRequireDefault(_domAttrs);

  var _domEventManager = require$$1$6;

  var _attrsToEvents = require$$0$8;

  var _attrsToEvents2 = _interopRequireDefault(_attrsToEvents);

  var _escapeHtml = require$$8;

  var _escapeHtml2 = _interopRequireDefault(_escapeHtml);

  var _isInArray = require$$2$4;

  var _isInArray2 = _interopRequireDefault(_isInArray);

  var _console = require$$0$1;

  var _console2 = _interopRequireDefault(_console);

  var _emptyObj = require$$5;

  var _emptyObj2 = _interopRequireDefault(_emptyObj);

  var _browsers = require$$4;

  var _createElement = require$$3$2;

  var _createElement2 = _interopRequireDefault(_createElement);

  var _createElementByHtml = require$$2$6;

  var _createElementByHtml2 = _interopRequireDefault(_createElementByHtml);

  var _ComponentNode = require$$1$3;

  var _ComponentNode2 = _interopRequireDefault(_ComponentNode);

  var _FunctionComponentNode = require$$0$5;

  var _FunctionComponentNode2 = _interopRequireDefault(_FunctionComponentNode);

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

  var require$$1$4 = (TagNode && typeof TagNode === 'object' && 'default' in TagNode ? TagNode['default'] : TagNode);

  var Select = __commonjs(function (module, exports) {
  'use strict';

  var _extends = Object.assign || function (target) {
      for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i];for (var key in source) {
              if (Object.prototype.hasOwnProperty.call(source, key)) {
                  target[key] = source[key];
              }
          }
      }return target;
  };

  Object.defineProperty(exports, "__esModule", {
      value: true
  });

  var _createComponent = require$$2$1;

  var _createComponent2 = _interopRequireDefault(_createComponent);

  var _TagNode = require$$1$4;

  var _TagNode2 = _interopRequireDefault(_TagNode);

  var _rafBatch = require$$0$3;

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

  var require$$1$2 = (Select && typeof Select === 'object' && 'default' in Select ? Select['default'] : Select);

  var Textarea = __commonjs(function (module, exports) {
  'use strict';

  var _extends = Object.assign || function (target) {
      for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i];for (var key in source) {
              if (Object.prototype.hasOwnProperty.call(source, key)) {
                  target[key] = source[key];
              }
          }
      }return target;
  };

  Object.defineProperty(exports, "__esModule", {
      value: true
  });

  var _createComponent = require$$2$1;

  var _createComponent2 = _interopRequireDefault(_createComponent);

  var _TagNode = require$$1$4;

  var _TagNode2 = _interopRequireDefault(_TagNode);

  var _rafBatch = require$$0$3;

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

  var require$$2$3 = (Textarea && typeof Textarea === 'object' && 'default' in Textarea ? Textarea['default'] : Textarea);

  var Input = __commonjs(function (module, exports) {
  'use strict';

  var _extends = Object.assign || function (target) {
      for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i];for (var key in source) {
              if (Object.prototype.hasOwnProperty.call(source, key)) {
                  target[key] = source[key];
              }
          }
      }return target;
  };

  Object.defineProperty(exports, "__esModule", {
      value: true
  });

  var _createComponent = require$$2$1;

  var _createComponent2 = _interopRequireDefault(_createComponent);

  var _TagNode = require$$1$4;

  var _TagNode2 = _interopRequireDefault(_TagNode);

  var _rafBatch = require$$0$3;

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

  var require$$3$1 = (Input && typeof Input === 'object' && 'default' in Input ? Input['default'] : Input);

  var createNode = __commonjs(function (module, exports) {
  'use strict';

  var _typeof = typeof Symbol === "function" && babelHelpers.typeof(Symbol.iterator) === "symbol" ? function (obj) {
      return typeof obj === "undefined" ? "undefined" : babelHelpers.typeof(obj);
  } : function (obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj === "undefined" ? "undefined" : babelHelpers.typeof(obj);
  };

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

  var _TagNode = require$$1$4;

  var _TagNode2 = _interopRequireDefault(_TagNode);

  var _ComponentNode = require$$1$3;

  var _ComponentNode2 = _interopRequireDefault(_ComponentNode);

  var _FunctionComponentNode = require$$0$5;

  var _FunctionComponentNode2 = _interopRequireDefault(_FunctionComponentNode);

  var _Input = require$$3$1;

  var _Input2 = _interopRequireDefault(_Input);

  var _Textarea = require$$2$3;

  var _Textarea2 = _interopRequireDefault(_Textarea);

  var _Select = require$$1$2;

  var _Select2 = _interopRequireDefault(_Select);

  var _console = require$$0$1;

  var _console2 = _interopRequireDefault(_console);

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

  var WRAPPER_COMPONENTS = {
      input: _Input2.default,
      textarea: _Textarea2.default,
      select: _Select2.default
  };
  });

  var require$$0 = (createNode && typeof createNode === 'object' && 'default' in createNode ? createNode['default'] : createNode);

  var createComponent$1 = __commonjs(function (module, exports) {
  'use strict';

  var _extends = Object.assign || function (target) {
      for (var i = 1; i < arguments.length; i++) {
          var source = arguments[i];for (var key in source) {
              if (Object.prototype.hasOwnProperty.call(source, key)) {
                  target[key] = source[key];
              }
          }
      }return target;
  };

  var _typeof = typeof Symbol === "function" && babelHelpers.typeof(Symbol.iterator) === "symbol" ? function (obj) {
      return typeof obj === "undefined" ? "undefined" : babelHelpers.typeof(obj);
  } : function (obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj === "undefined" ? "undefined" : babelHelpers.typeof(obj);
  };

  Object.defineProperty(exports, "__esModule", {
      value: true
  });

  var _noOp = require$$0$4;

  var _noOp2 = _interopRequireDefault(_noOp);

  var _rafBatch = require$$0$3;

  var _rafBatch2 = _interopRequireDefault(_rafBatch);

  var _createNode = require$$0;

  var _createNode2 = _interopRequireDefault(_createNode);

  var _console = require$$0$1;

  var _console2 = _interopRequireDefault(_console);

  var _emptyObj = require$$5;

  var _emptyObj2 = _interopRequireDefault(_emptyObj);

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

  var require$$2$1 = (createComponent$1 && typeof createComponent$1 === 'object' && 'default' in createComponent$1 ? createComponent$1['default'] : createComponent$1);

  var Component$1 = __commonjs(function (module, exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  var _createComponent = require$$2$1;

  var _createComponent2 = _interopRequireDefault(_createComponent);

  function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : { default: obj };
  }

  exports.default = (0, _createComponent2.default)();
  });

  var require$$1 = (Component$1 && typeof Component$1 === 'object' && 'default' in Component$1 ? Component$1['default'] : Component$1);

  var normalizeChildren$1 = __commonjs(function (module, exports) {
  'use strict';

  var _typeof = typeof Symbol === "function" && babelHelpers.typeof(Symbol.iterator) === "symbol" ? function (obj) {
      return typeof obj === "undefined" ? "undefined" : babelHelpers.typeof(obj);
  } : function (obj) {
      return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj === "undefined" ? "undefined" : babelHelpers.typeof(obj);
  };

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

  var _createNode = require$$0;

  var _createNode2 = _interopRequireDefault(_createNode);

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

  var require$$2$2 = (normalizeChildren$1 && typeof normalizeChildren$1 === 'object' && 'default' in normalizeChildren$1 ? normalizeChildren$1['default'] : normalizeChildren$1);

  var renderToString$1 = __commonjs(function (module, exports) {
  "use strict";

  Object.defineProperty(exports, "__esModule", {
    value: true
  });

  exports.default = function (tree) {
    return tree.renderToString();
  };
  });

  var require$$3 = (renderToString$1 && typeof renderToString$1 === 'object' && 'default' in renderToString$1 ? renderToString$1['default'] : renderToString$1);

  var mounter = __commonjs(function (module, exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
      value: true
  });
  exports.mountToDom = mountToDom;
  exports.mountToDomSync = mountToDomSync;
  exports.unmountFromDom = unmountFromDom;
  exports.unmountFromDomSync = unmountFromDomSync;

  var _getDomNodeId = require$$0$6;

  var _getDomNodeId2 = _interopRequireDefault(_getDomNodeId);

  var _rafBatch = require$$0$3;

  var _rafBatch2 = _interopRequireDefault(_rafBatch);

  var _emptyObj = require$$5;

  var _emptyObj2 = _interopRequireDefault(_emptyObj);

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

  var require$$6 = (mounter && typeof mounter === 'object' && 'default' in mounter ? mounter['default'] : mounter);

  var vidom = __commonjs(function (module, exports) {
  'use strict';

  Object.defineProperty(exports, "__esModule", {
      value: true
  });
  exports.Component = exports.normalizeChildren = exports.renderToString = exports.createComponent = exports.node = exports.unmountFromDomSync = exports.unmountFromDom = exports.mountToDomSync = exports.mountToDom = undefined;

  var _mounter = require$$6;

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

  var _createNode = require$$0;

  var _createNode2 = _interopRequireDefault(_createNode);

  var _createComponent = require$$2$1;

  var _createComponent2 = _interopRequireDefault(_createComponent);

  var _renderToString = require$$3;

  var _renderToString2 = _interopRequireDefault(_renderToString);

  var _normalizeChildren = require$$2$2;

  var _normalizeChildren2 = _interopRequireDefault(_normalizeChildren);

  var _Component = require$$1;

  var _Component2 = _interopRequireDefault(_Component);

  var _console = require$$0$1;

  var _console2 = _interopRequireDefault(_console);

  function _interopRequireDefault(obj) {
      return obj && obj.__esModule ? obj : { default: obj };
  }

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
  });

}));
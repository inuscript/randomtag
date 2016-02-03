(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = require('./lib/axios');
},{"./lib/axios":3}],2:[function(require,module,exports){
'use strict';

var utils = require('./../utils');
var buildURL = require('./../helpers/buildURL');
var parseHeaders = require('./../helpers/parseHeaders');
var transformData = require('./../helpers/transformData');
var isURLSameOrigin = require('./../helpers/isURLSameOrigin');
var btoa = window.btoa || require('./../helpers/btoa');

module.exports = function xhrAdapter(resolve, reject, config) {
  var requestData = config.data;
  var requestHeaders = config.headers;

  if (utils.isFormData(requestData)) {
    delete requestHeaders['Content-Type']; // Let the browser set it
  }

  var request = new XMLHttpRequest();

  // For IE 8/9 CORS support
  // Only supports POST and GET calls and doesn't returns the response headers.
  if (window.XDomainRequest && !('withCredentials' in request) && !isURLSameOrigin(config.url)) {
    request = new window.XDomainRequest();
  }

  // HTTP basic authentication
  if (config.auth) {
    var username = config.auth.username || '';
    var password = config.auth.password || '';
    requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
  }

  request.open(config.method.toUpperCase(), buildURL(config.url, config.params, config.paramsSerializer), true);

  // Set the request timeout in MS
  request.timeout = config.timeout;

  // Listen for ready state
  request.onload = function handleLoad() {
    if (!request) {
      return;
    }
    // Prepare the response
    var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
    var responseData = ['text', ''].indexOf(config.responseType || '') !== -1 ? request.responseText : request.response;
    var response = {
      data: transformData(
        responseData,
        responseHeaders,
        config.transformResponse
      ),
      // IE sends 1223 instead of 204 (https://github.com/mzabriskie/axios/issues/201)
      status: request.status === 1223 ? 204 : request.status,
      statusText: request.status === 1223 ? 'No Content' : request.statusText,
      headers: responseHeaders,
      config: config
    };

    // Resolve or reject the Promise based on the status
    ((response.status >= 200 && response.status < 300) ||
     (!('status' in request) && response.responseText) ?
      resolve :
      reject)(response);

    // Clean up request
    request = null;
  };

  // Handle low level network errors
  request.onerror = function handleError() {
    // Real errors are hidden from us by the browser
    // onerror should only fire if it's a network error
    reject(new Error('Network Error'));

    // Clean up request
    request = null;
  };

  // Add xsrf header
  // This is only done if running in a standard browser environment.
  // Specifically not if we're in a web worker, or react-native.
  if (utils.isStandardBrowserEnv()) {
    var cookies = require('./../helpers/cookies');

    // Add xsrf header
    var xsrfValue = config.withCredentials || isURLSameOrigin(config.url) ?
        cookies.read(config.xsrfCookieName) :
        undefined;

    if (xsrfValue) {
      requestHeaders[config.xsrfHeaderName] = xsrfValue;
    }
  }

  // Add headers to the request
  if ('setRequestHeader' in request) {
    utils.forEach(requestHeaders, function setRequestHeader(val, key) {
      if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
        // Remove Content-Type if data is undefined
        delete requestHeaders[key];
      } else {
        // Otherwise add header to the request
        request.setRequestHeader(key, val);
      }
    });
  }

  // Add withCredentials to request if needed
  if (config.withCredentials) {
    request.withCredentials = true;
  }

  // Add responseType to request if needed
  if (config.responseType) {
    try {
      request.responseType = config.responseType;
    } catch (e) {
      if (request.responseType !== 'json') {
        throw e;
      }
    }
  }

  if (utils.isArrayBuffer(requestData)) {
    requestData = new DataView(requestData);
  }

  // Send the request
  request.send(requestData);
};

},{"./../helpers/btoa":8,"./../helpers/buildURL":9,"./../helpers/cookies":11,"./../helpers/isURLSameOrigin":13,"./../helpers/parseHeaders":14,"./../helpers/transformData":16,"./../utils":17}],3:[function(require,module,exports){
'use strict';

var defaults = require('./defaults');
var utils = require('./utils');
var dispatchRequest = require('./core/dispatchRequest');
var InterceptorManager = require('./core/InterceptorManager');
var isAbsoluteURL = require('./helpers/isAbsoluteURL');
var combineURLs = require('./helpers/combineURLs');
var bind = require('./helpers/bind');
var transformData = require('./helpers/transformData');

function Axios(defaultConfig) {
  this.defaults = utils.merge({}, defaultConfig);
  this.interceptors = {
    request: new InterceptorManager(),
    response: new InterceptorManager()
  };
}

Axios.prototype.request = function request(config) {
  /*eslint no-param-reassign:0*/
  // Allow for axios('example/url'[, config]) a la fetch API
  if (typeof config === 'string') {
    config = utils.merge({
      url: arguments[0]
    }, arguments[1]);
  }

  config = utils.merge(defaults, this.defaults, { method: 'get' }, config);

  // Support baseURL config
  if (config.baseURL && !isAbsoluteURL(config.url)) {
    config.url = combineURLs(config.baseURL, config.url);
  }

  // Don't allow overriding defaults.withCredentials
  config.withCredentials = config.withCredentials || this.defaults.withCredentials;

  // Transform request data
  config.data = transformData(
    config.data,
    config.headers,
    config.transformRequest
  );

  // Flatten headers
  config.headers = utils.merge(
    config.headers.common || {},
    config.headers[config.method] || {},
    config.headers || {}
  );

  utils.forEach(
    ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
    function cleanHeaderConfig(method) {
      delete config.headers[method];
    }
  );

  // Hook up interceptors middleware
  var chain = [dispatchRequest, undefined];
  var promise = Promise.resolve(config);

  this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
    chain.unshift(interceptor.fulfilled, interceptor.rejected);
  });

  this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
    chain.push(interceptor.fulfilled, interceptor.rejected);
  });

  while (chain.length) {
    promise = promise.then(chain.shift(), chain.shift());
  }

  return promise;
};

var defaultInstance = new Axios(defaults);
var axios = module.exports = bind(Axios.prototype.request, defaultInstance);

axios.create = function create(defaultConfig) {
  return new Axios(defaultConfig);
};

// Expose defaults
axios.defaults = defaultInstance.defaults;

// Expose all/spread
axios.all = function all(promises) {
  return Promise.all(promises);
};
axios.spread = require('./helpers/spread');

// Expose interceptors
axios.interceptors = defaultInstance.interceptors;

// Provide aliases for supported request methods
utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url
    }));
  };
  axios[method] = bind(Axios.prototype[method], defaultInstance);
});

utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
  /*eslint func-names:0*/
  Axios.prototype[method] = function(url, data, config) {
    return this.request(utils.merge(config || {}, {
      method: method,
      url: url,
      data: data
    }));
  };
  axios[method] = bind(Axios.prototype[method], defaultInstance);
});

},{"./core/InterceptorManager":4,"./core/dispatchRequest":5,"./defaults":6,"./helpers/bind":7,"./helpers/combineURLs":10,"./helpers/isAbsoluteURL":12,"./helpers/spread":15,"./helpers/transformData":16,"./utils":17}],4:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function InterceptorManager() {
  this.handlers = [];
}

/**
 * Add a new interceptor to the stack
 *
 * @param {Function} fulfilled The function to handle `then` for a `Promise`
 * @param {Function} rejected The function to handle `reject` for a `Promise`
 *
 * @return {Number} An ID used to remove interceptor later
 */
InterceptorManager.prototype.use = function use(fulfilled, rejected) {
  this.handlers.push({
    fulfilled: fulfilled,
    rejected: rejected
  });
  return this.handlers.length - 1;
};

/**
 * Remove an interceptor from the stack
 *
 * @param {Number} id The ID that was returned by `use`
 */
InterceptorManager.prototype.eject = function eject(id) {
  if (this.handlers[id]) {
    this.handlers[id] = null;
  }
};

/**
 * Iterate over all the registered interceptors
 *
 * This method is particularly useful for skipping over any
 * interceptors that may have become `null` calling `eject`.
 *
 * @param {Function} fn The function to call for each interceptor
 */
InterceptorManager.prototype.forEach = function forEach(fn) {
  utils.forEach(this.handlers, function forEachHandler(h) {
    if (h !== null) {
      fn(h);
    }
  });
};

module.exports = InterceptorManager;

},{"./../utils":17}],5:[function(require,module,exports){
(function (process){
'use strict';

/**
 * Dispatch a request to the server using whichever adapter
 * is supported by the current environment.
 *
 * @param {object} config The config that is to be used for the request
 * @returns {Promise} The Promise to be fulfilled
 */
module.exports = function dispatchRequest(config) {
  return new Promise(function executor(resolve, reject) {
    try {
      var adapter;

      if (typeof config.adapter === 'function') {
        // For custom adapter support
        adapter = config.adapter;
      } else if (typeof XMLHttpRequest !== 'undefined') {
        // For browsers use XHR adapter
        adapter = require('../adapters/xhr');
      } else if (typeof process !== 'undefined') {
        // For node use HTTP adapter
        adapter = require('../adapters/http');
      }

      if (typeof adapter === 'function') {
        adapter(resolve, reject, config);
      }
    } catch (e) {
      reject(e);
    }
  });
};


}).call(this,require('_process'))

},{"../adapters/http":2,"../adapters/xhr":2,"_process":32}],6:[function(require,module,exports){
'use strict';

var utils = require('./utils');

var PROTECTION_PREFIX = /^\)\]\}',?\n/;
var DEFAULT_CONTENT_TYPE = {
  'Content-Type': 'application/x-www-form-urlencoded'
};

module.exports = {
  transformRequest: [function transformResponseJSON(data, headers) {
    if (utils.isFormData(data)) {
      return data;
    }
    if (utils.isArrayBuffer(data)) {
      return data;
    }
    if (utils.isArrayBufferView(data)) {
      return data.buffer;
    }
    if (utils.isObject(data) && !utils.isFile(data) && !utils.isBlob(data)) {
      // Set application/json if no Content-Type has been specified
      if (!utils.isUndefined(headers)) {
        utils.forEach(headers, function processContentTypeHeader(val, key) {
          if (key.toLowerCase() === 'content-type') {
            headers['Content-Type'] = val;
          }
        });

        if (utils.isUndefined(headers['Content-Type'])) {
          headers['Content-Type'] = 'application/json;charset=utf-8';
        }
      }
      return JSON.stringify(data);
    }
    return data;
  }],

  transformResponse: [function transformResponseJSON(data) {
    /*eslint no-param-reassign:0*/
    if (typeof data === 'string') {
      data = data.replace(PROTECTION_PREFIX, '');
      try {
        data = JSON.parse(data);
      } catch (e) { /* Ignore */ }
    }
    return data;
  }],

  headers: {
    common: {
      'Accept': 'application/json, text/plain, */*'
    },
    patch: utils.merge(DEFAULT_CONTENT_TYPE),
    post: utils.merge(DEFAULT_CONTENT_TYPE),
    put: utils.merge(DEFAULT_CONTENT_TYPE)
  },

  timeout: 0,

  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN'
};

},{"./utils":17}],7:[function(require,module,exports){
'use strict';

module.exports = function bind(fn, thisArg) {
  return function wrap() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    return fn.apply(thisArg, args);
  };
};

},{}],8:[function(require,module,exports){
'use strict';

// btoa polyfill for IE<10 courtesy https://github.com/davidchambers/Base64.js

var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function InvalidCharacterError(message) {
  this.message = message;
}
InvalidCharacterError.prototype = new Error;
InvalidCharacterError.prototype.code = 5;
InvalidCharacterError.prototype.name = 'InvalidCharacterError';

function btoa(input) {
  var str = String(input);
  var output = '';
  for (
    // initialize result and counter
    var block, charCode, idx = 0, map = chars;
    // if the next str index does not exist:
    //   change the mapping table to "="
    //   check if d has no fractional digits
    str.charAt(idx | 0) || (map = '=', idx % 1);
    // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
    output += map.charAt(63 & block >> 8 - idx % 1 * 8)
  ) {
    charCode = str.charCodeAt(idx += 3 / 4);
    if (charCode > 0xFF) {
      throw new InvalidCharacterError('INVALID_CHARACTER_ERR: DOM Exception 5');
    }
    block = block << 8 | charCode;
  }
  return output;
}

module.exports = btoa;

},{}],9:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

function encode(val) {
  return encodeURIComponent(val).
    replace(/%40/gi, '@').
    replace(/%3A/gi, ':').
    replace(/%24/g, '$').
    replace(/%2C/gi, ',').
    replace(/%20/g, '+').
    replace(/%5B/gi, '[').
    replace(/%5D/gi, ']');
}

/**
 * Build a URL by appending params to the end
 *
 * @param {string} url The base of the url (e.g., http://www.google.com)
 * @param {object} [params] The params to be appended
 * @returns {string} The formatted url
 */
module.exports = function buildURL(url, params, paramsSerializer) {
  /*eslint no-param-reassign:0*/
  if (!params) {
    return url;
  }

  var serializedParams;
  if (paramsSerializer) {
    serializedParams = paramsSerializer(params);
  } else {
    var parts = [];

    utils.forEach(params, function serialize(val, key) {
      if (val === null || typeof val === 'undefined') {
        return;
      }

      if (utils.isArray(val)) {
        key = key + '[]';
      }

      if (!utils.isArray(val)) {
        val = [val];
      }

      utils.forEach(val, function parseValue(v) {
        if (utils.isDate(v)) {
          v = v.toISOString();
        } else if (utils.isObject(v)) {
          v = JSON.stringify(v);
        }
        parts.push(encode(key) + '=' + encode(v));
      });
    });

    serializedParams = parts.join('&');
  }

  if (serializedParams) {
    url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
  }

  return url;
};


},{"./../utils":17}],10:[function(require,module,exports){
'use strict';

/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
module.exports = function combineURLs(baseURL, relativeURL) {
  return baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '');
};

},{}],11:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs support document.cookie
  (function standardBrowserEnv() {
    return {
      write: function write(name, value, expires, path, domain, secure) {
        var cookie = [];
        cookie.push(name + '=' + encodeURIComponent(value));

        if (utils.isNumber(expires)) {
          cookie.push('expires=' + new Date(expires).toGMTString());
        }

        if (utils.isString(path)) {
          cookie.push('path=' + path);
        }

        if (utils.isString(domain)) {
          cookie.push('domain=' + domain);
        }

        if (secure === true) {
          cookie.push('secure');
        }

        document.cookie = cookie.join('; ');
      },

      read: function read(name) {
        var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
        return (match ? decodeURIComponent(match[3]) : null);
      },

      remove: function remove(name) {
        this.write(name, '', Date.now() - 86400000);
      }
    };
  })() :

  // Non standard browser env (web workers, react-native) lack needed support.
  (function nonStandardBrowserEnv() {
    return {
      write: function write() {},
      read: function read() { return null; },
      remove: function remove() {}
    };
  })()
);

},{"./../utils":17}],12:[function(require,module,exports){
'use strict';

/**
 * Determines whether the specified URL is absolute
 *
 * @param {string} url The URL to test
 * @returns {boolean} True if the specified URL is absolute, otherwise false
 */
module.exports = function isAbsoluteURL(url) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
  // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
  // by any combination of letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
};

},{}],13:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

module.exports = (
  utils.isStandardBrowserEnv() ?

  // Standard browser envs have full support of the APIs needed to test
  // whether the request URL is of the same origin as current location.
  (function standardBrowserEnv() {
    var msie = /(msie|trident)/i.test(navigator.userAgent);
    var urlParsingNode = document.createElement('a');
    var originURL;

    /**
    * Parse a URL to discover it's components
    *
    * @param {String} url The URL to be parsed
    * @returns {Object}
    */
    function resolveURL(url) {
      var href = url;

      if (msie) {
        // IE needs attribute set twice to normalize properties
        urlParsingNode.setAttribute('href', href);
        href = urlParsingNode.href;
      }

      urlParsingNode.setAttribute('href', href);

      // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
      return {
        href: urlParsingNode.href,
        protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
        host: urlParsingNode.host,
        search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
        hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
        hostname: urlParsingNode.hostname,
        port: urlParsingNode.port,
        pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                  urlParsingNode.pathname :
                  '/' + urlParsingNode.pathname
      };
    }

    originURL = resolveURL(window.location.href);

    /**
    * Determine if a URL shares the same origin as the current location
    *
    * @param {String} requestURL The URL to test
    * @returns {boolean} True if URL shares the same origin, otherwise false
    */
    return function isURLSameOrigin(requestURL) {
      var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
      return (parsed.protocol === originURL.protocol &&
            parsed.host === originURL.host);
    };
  })() :

  // Non standard browser envs (web workers, react-native) lack needed support.
  (function nonStandardBrowserEnv() {
    return function isURLSameOrigin() {
      return true;
    };
  })()
);

},{"./../utils":17}],14:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

/**
 * Parse headers into an object
 *
 * ```
 * Date: Wed, 27 Aug 2014 08:58:49 GMT
 * Content-Type: application/json
 * Connection: keep-alive
 * Transfer-Encoding: chunked
 * ```
 *
 * @param {String} headers Headers needing to be parsed
 * @returns {Object} Headers parsed into an object
 */
module.exports = function parseHeaders(headers) {
  var parsed = {};
  var key;
  var val;
  var i;

  if (!headers) { return parsed; }

  utils.forEach(headers.split('\n'), function parser(line) {
    i = line.indexOf(':');
    key = utils.trim(line.substr(0, i)).toLowerCase();
    val = utils.trim(line.substr(i + 1));

    if (key) {
      parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
    }
  });

  return parsed;
};

},{"./../utils":17}],15:[function(require,module,exports){
'use strict';

/**
 * Syntactic sugar for invoking a function and expanding an array for arguments.
 *
 * Common use case would be to use `Function.prototype.apply`.
 *
 *  ```js
 *  function f(x, y, z) {}
 *  var args = [1, 2, 3];
 *  f.apply(null, args);
 *  ```
 *
 * With `spread` this example can be re-written.
 *
 *  ```js
 *  spread(function(x, y, z) {})([1, 2, 3]);
 *  ```
 *
 * @param {Function} callback
 * @returns {Function}
 */
module.exports = function spread(callback) {
  return function wrap(arr) {
    return callback.apply(null, arr);
  };
};

},{}],16:[function(require,module,exports){
'use strict';

var utils = require('./../utils');

/**
 * Transform the data for a request or a response
 *
 * @param {Object|String} data The data to be transformed
 * @param {Array} headers The headers for the request or response
 * @param {Array|Function} fns A single function or Array of functions
 * @returns {*} The resulting transformed data
 */
module.exports = function transformData(data, headers, fns) {
  /*eslint no-param-reassign:0*/
  utils.forEach(fns, function transform(fn) {
    data = fn(data, headers);
  });

  return data;
};

},{"./../utils":17}],17:[function(require,module,exports){
'use strict';

/*global toString:true*/

// utils is a library of generic helper functions non-specific to axios

var toString = Object.prototype.toString;

/**
 * Determine if a value is an Array
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Array, otherwise false
 */
function isArray(val) {
  return toString.call(val) === '[object Array]';
}

/**
 * Determine if a value is an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an ArrayBuffer, otherwise false
 */
function isArrayBuffer(val) {
  return toString.call(val) === '[object ArrayBuffer]';
}

/**
 * Determine if a value is a FormData
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an FormData, otherwise false
 */
function isFormData(val) {
  return toString.call(val) === '[object FormData]';
}

/**
 * Determine if a value is a view on an ArrayBuffer
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
 */
function isArrayBufferView(val) {
  var result;
  if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
    result = ArrayBuffer.isView(val);
  } else {
    result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
  }
  return result;
}

/**
 * Determine if a value is a String
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a String, otherwise false
 */
function isString(val) {
  return typeof val === 'string';
}

/**
 * Determine if a value is a Number
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Number, otherwise false
 */
function isNumber(val) {
  return typeof val === 'number';
}

/**
 * Determine if a value is undefined
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if the value is undefined, otherwise false
 */
function isUndefined(val) {
  return typeof val === 'undefined';
}

/**
 * Determine if a value is an Object
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is an Object, otherwise false
 */
function isObject(val) {
  return val !== null && typeof val === 'object';
}

/**
 * Determine if a value is a Date
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Date, otherwise false
 */
function isDate(val) {
  return toString.call(val) === '[object Date]';
}

/**
 * Determine if a value is a File
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a File, otherwise false
 */
function isFile(val) {
  return toString.call(val) === '[object File]';
}

/**
 * Determine if a value is a Blob
 *
 * @param {Object} val The value to test
 * @returns {boolean} True if value is a Blob, otherwise false
 */
function isBlob(val) {
  return toString.call(val) === '[object Blob]';
}

/**
 * Trim excess whitespace off the beginning and end of a string
 *
 * @param {String} str The String to trim
 * @returns {String} The String freed of excess whitespace
 */
function trim(str) {
  return str.replace(/^\s*/, '').replace(/\s*$/, '');
}

/**
 * Determine if we're running in a standard browser environment
 *
 * This allows axios to run in a web worker, and react-native.
 * Both environments support XMLHttpRequest, but not fully standard globals.
 *
 * web workers:
 *  typeof window -> undefined
 *  typeof document -> undefined
 *
 * react-native:
 *  typeof document.createElement -> undefined
 */
function isStandardBrowserEnv() {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof document.createElement === 'function'
  );
}

/**
 * Iterate over an Array or an Object invoking a function for each item.
 *
 * If `obj` is an Array callback will be called passing
 * the value, index, and complete array for each item.
 *
 * If 'obj' is an Object callback will be called passing
 * the value, key, and complete object for each property.
 *
 * @param {Object|Array} obj The object to iterate
 * @param {Function} fn The callback to invoke for each item
 */
function forEach(obj, fn) {
  // Don't bother if no value provided
  if (obj === null || typeof obj === 'undefined') {
    return;
  }

  // Force an array if not already something iterable
  if (typeof obj !== 'object' && !isArray(obj)) {
    /*eslint no-param-reassign:0*/
    obj = [obj];
  }

  if (isArray(obj)) {
    // Iterate over array values
    for (var i = 0, l = obj.length; i < l; i++) {
      fn.call(null, obj[i], i, obj);
    }
  } else {
    // Iterate over object keys
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        fn.call(null, obj[key], key, obj);
      }
    }
  }
}

/**
 * Accepts varargs expecting each argument to be an object, then
 * immutably merges the properties of each object and returns result.
 *
 * When multiple objects contain the same key the later object in
 * the arguments list will take precedence.
 *
 * Example:
 *
 * ```js
 * var result = merge({foo: 123}, {foo: 456});
 * console.log(result.foo); // outputs 456
 * ```
 *
 * @param {Object} obj1 Object to merge
 * @returns {Object} Result of all merge properties
 */
function merge(/* obj1, obj2, obj3, ... */) {
  var result = {};
  function assignValue(val, key) {
    if (typeof result[key] === 'object' && typeof val === 'object') {
      result[key] = merge(result[key], val);
    } else {
      result[key] = val;
    }
  }

  for (var i = 0, l = arguments.length; i < l; i++) {
    forEach(arguments[i], assignValue);
  }
  return result;
}

module.exports = {
  isArray: isArray,
  isArrayBuffer: isArrayBuffer,
  isFormData: isFormData,
  isArrayBufferView: isArrayBufferView,
  isString: isString,
  isNumber: isNumber,
  isObject: isObject,
  isUndefined: isUndefined,
  isDate: isDate,
  isFile: isFile,
  isBlob: isBlob,
  isStandardBrowserEnv: isStandardBrowserEnv,
  forEach: forEach,
  merge: merge,
  trim: trim
};

},{}],18:[function(require,module,exports){
;(function (exports) {
  'use strict'

  var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

  var PLUS = '+'.charCodeAt(0)
  var SLASH = '/'.charCodeAt(0)
  var NUMBER = '0'.charCodeAt(0)
  var LOWER = 'a'.charCodeAt(0)
  var UPPER = 'A'.charCodeAt(0)
  var PLUS_URL_SAFE = '-'.charCodeAt(0)
  var SLASH_URL_SAFE = '_'.charCodeAt(0)

  function decode (elt) {
    var code = elt.charCodeAt(0)
    if (code === PLUS || code === PLUS_URL_SAFE) return 62 // '+'
    if (code === SLASH || code === SLASH_URL_SAFE) return 63 // '/'
    if (code < NUMBER) return -1 // no match
    if (code < NUMBER + 10) return code - NUMBER + 26 + 26
    if (code < UPPER + 26) return code - UPPER
    if (code < LOWER + 26) return code - LOWER + 26
  }

  function b64ToByteArray (b64) {
    var i, j, l, tmp, placeHolders, arr

    if (b64.length % 4 > 0) {
      throw new Error('Invalid string. Length must be a multiple of 4')
    }

    // the number of equal signs (place holders)
    // if there are two placeholders, than the two characters before it
    // represent one byte
    // if there is only one, then the three characters before it represent 2 bytes
    // this is just a cheap hack to not do indexOf twice
    var len = b64.length
    placeHolders = b64.charAt(len - 2) === '=' ? 2 : b64.charAt(len - 1) === '=' ? 1 : 0

    // base64 is 4/3 + up to two characters of the original data
    arr = new Arr(b64.length * 3 / 4 - placeHolders)

    // if there are placeholders, only get up to the last complete 4 chars
    l = placeHolders > 0 ? b64.length - 4 : b64.length

    var L = 0

    function push (v) {
      arr[L++] = v
    }

    for (i = 0, j = 0; i < l; i += 4, j += 3) {
      tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
      push((tmp & 0xFF0000) >> 16)
      push((tmp & 0xFF00) >> 8)
      push(tmp & 0xFF)
    }

    if (placeHolders === 2) {
      tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
      push(tmp & 0xFF)
    } else if (placeHolders === 1) {
      tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
      push((tmp >> 8) & 0xFF)
      push(tmp & 0xFF)
    }

    return arr
  }

  function uint8ToBase64 (uint8) {
    var i
    var extraBytes = uint8.length % 3 // if we have 1 byte left, pad 2 bytes
    var output = ''
    var temp, length

    function encode (num) {
      return lookup.charAt(num)
    }

    function tripletToBase64 (num) {
      return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
    }

    // go through the array every three bytes, we'll deal with trailing stuff later
    for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
      temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
      output += tripletToBase64(temp)
    }

    // pad the end with zeros, but make sure to not forget the extra bytes
    switch (extraBytes) {
      case 1:
        temp = uint8[uint8.length - 1]
        output += encode(temp >> 2)
        output += encode((temp << 4) & 0x3F)
        output += '=='
        break
      case 2:
        temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
        output += encode(temp >> 10)
        output += encode((temp >> 4) & 0x3F)
        output += encode((temp << 2) & 0x3F)
        output += '='
        break
      default:
        break
    }

    return output
  }

  exports.toByteArray = b64ToByteArray
  exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],19:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    return arr.foo() === 42 && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    this.length = 0
    this.parent = undefined
  }

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer._augment = function (arr) {
  arr.__proto__ = Buffer.prototype
  return arr
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  array.byteLength // this throws if `array` is not a valid ArrayBuffer

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(array)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
} else {
  // pre-set for values that may exist in the future
  Buffer.prototype.length = undefined
  Buffer.prototype.parent = undefined
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length)
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer.prototype._isBuffer = true

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end)
    newBuf.__proto__ = Buffer.prototype
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    )
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"base64-js":18,"ieee754":30,"isarray":20}],20:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],21:[function(require,module,exports){
(function (Buffer){
//  Chance.js 0.8.0
//  http://chancejs.com
//  (c) 2013 Victor Quinn
//  Chance may be freely distributed or modified under the MIT license.

(function () {

    // Constants
    var MAX_INT = 9007199254740992;
    var MIN_INT = -MAX_INT;
    var NUMBERS = '0123456789';
    var CHARS_LOWER = 'abcdefghijklmnopqrstuvwxyz';
    var CHARS_UPPER = CHARS_LOWER.toUpperCase();
    var HEX_POOL  = NUMBERS + "abcdef";

    // Cached array helpers
    var slice = Array.prototype.slice;

    // Constructor
    function Chance (seed) {
        if (!(this instanceof Chance)) {
            return seed == null ? new Chance() : new Chance(seed);
        }

        // if user has provided a function, use that as the generator
        if (typeof seed === 'function') {
            this.random = seed;
            return this;
        }

        if (arguments.length) {
            // set a starting value of zero so we can add to it
            this.seed = 0;
        }

        // otherwise, leave this.seed blank so that MT will receive a blank

        for (var i = 0; i < arguments.length; i++) {
            var seedling = 0;
            if (Object.prototype.toString.call(arguments[i]) === '[object String]') {
                for (var j = 0; j < arguments[i].length; j++) {
                    // create a numeric hash for each argument, add to seedling
                    var hash = 0;
                    for (var k = 0; k < arguments[i].length; k++) {
                        hash = arguments[i].charCodeAt(k) + (hash << 6) + (hash << 16) - hash;
                    }
                    seedling += hash;
                }
            } else {
                seedling = arguments[i];
            }
            this.seed += (arguments.length - i) * seedling;
        }

        // If no generator function was provided, use our MT
        this.mt = this.mersenne_twister(this.seed);
        this.bimd5 = this.blueimp_md5();
        this.random = function () {
            return this.mt.random(this.seed);
        };

        return this;
    }

    Chance.prototype.VERSION = "0.8.0";

    // Random helper functions
    function initOptions(options, defaults) {
        options || (options = {});

        if (defaults) {
            for (var i in defaults) {
                if (typeof options[i] === 'undefined') {
                    options[i] = defaults[i];
                }
            }
        }

        return options;
    }

    function testRange(test, errorMessage) {
        if (test) {
            throw new RangeError(errorMessage);
        }
    }

    /**
     * Encode the input string with Base64.
     */
    var base64 = function() {
        throw new Error('No Base64 encoder available.');
    };

    // Select proper Base64 encoder.
    (function determineBase64Encoder() {
        if (typeof btoa === 'function') {
            base64 = btoa;
        } else if (typeof Buffer === 'function') {
            base64 = function(input) {
                return new Buffer(input).toString('base64');
            };
        }
    })();

    // -- Basics --

    /**
     *  Return a random bool, either true or false
     *
     *  @param {Object} [options={ likelihood: 50 }] alter the likelihood of
     *    receiving a true or false value back.
     *  @throws {RangeError} if the likelihood is out of bounds
     *  @returns {Bool} either true or false
     */
    Chance.prototype.bool = function (options) {
        // likelihood of success (true)
        options = initOptions(options, {likelihood : 50});

        // Note, we could get some minor perf optimizations by checking range
        // prior to initializing defaults, but that makes code a bit messier
        // and the check more complicated as we have to check existence of
        // the object then existence of the key before checking constraints.
        // Since the options initialization should be minor computationally,
        // decision made for code cleanliness intentionally. This is mentioned
        // here as it's the first occurrence, will not be mentioned again.
        testRange(
            options.likelihood < 0 || options.likelihood > 100,
            "Chance: Likelihood accepts values from 0 to 100."
        );

        return this.random() * 100 < options.likelihood;
    };

    /**
     *  Return a random character.
     *
     *  @param {Object} [options={}] can specify a character pool, only alpha,
     *    only symbols, and casing (lower or upper)
     *  @returns {String} a single random character
     *  @throws {RangeError} Can only specify alpha or symbols, not both
     */
    Chance.prototype.character = function (options) {
        options = initOptions(options);
        testRange(
            options.alpha && options.symbols,
            "Chance: Cannot specify both alpha and symbols."
        );

        var symbols = "!@#$%^&*()[]",
            letters, pool;

        if (options.casing === 'lower') {
            letters = CHARS_LOWER;
        } else if (options.casing === 'upper') {
            letters = CHARS_UPPER;
        } else {
            letters = CHARS_LOWER + CHARS_UPPER;
        }

        if (options.pool) {
            pool = options.pool;
        } else if (options.alpha) {
            pool = letters;
        } else if (options.symbols) {
            pool = symbols;
        } else {
            pool = letters + NUMBERS + symbols;
        }

        return pool.charAt(this.natural({max: (pool.length - 1)}));
    };

    // Note, wanted to use "float" or "double" but those are both JS reserved words.

    // Note, fixed means N OR LESS digits after the decimal. This because
    // It could be 14.9000 but in JavaScript, when this is cast as a number,
    // the trailing zeroes are dropped. Left to the consumer if trailing zeroes are
    // needed
    /**
     *  Return a random floating point number
     *
     *  @param {Object} [options={}] can specify a fixed precision, min, max
     *  @returns {Number} a single floating point number
     *  @throws {RangeError} Can only specify fixed or precision, not both. Also
     *    min cannot be greater than max
     */
    Chance.prototype.floating = function (options) {
        options = initOptions(options, {fixed : 4});
        testRange(
            options.fixed && options.precision,
            "Chance: Cannot specify both fixed and precision."
        );

        var num;
        var fixed = Math.pow(10, options.fixed);

        var max = MAX_INT / fixed;
        var min = -max;

        testRange(
            options.min && options.fixed && options.min < min,
            "Chance: Min specified is out of range with fixed. Min should be, at least, " + min
        );
        testRange(
            options.max && options.fixed && options.max > max,
            "Chance: Max specified is out of range with fixed. Max should be, at most, " + max
        );

        options = initOptions(options, { min : min, max : max });

        // Todo - Make this work!
        // options.precision = (typeof options.precision !== "undefined") ? options.precision : false;

        num = this.integer({min: options.min * fixed, max: options.max * fixed});
        var num_fixed = (num / fixed).toFixed(options.fixed);

        return parseFloat(num_fixed);
    };

    /**
     *  Return a random integer
     *
     *  NOTE the max and min are INCLUDED in the range. So:
     *  chance.integer({min: 1, max: 3});
     *  would return either 1, 2, or 3.
     *
     *  @param {Object} [options={}] can specify a min and/or max
     *  @returns {Number} a single random integer number
     *  @throws {RangeError} min cannot be greater than max
     */
    Chance.prototype.integer = function (options) {
        // 9007199254740992 (2^53) is the max integer number in JavaScript
        // See: http://vq.io/132sa2j
        options = initOptions(options, {min: MIN_INT, max: MAX_INT});
        testRange(options.min > options.max, "Chance: Min cannot be greater than Max.");

        return Math.floor(this.random() * (options.max - options.min + 1) + options.min);
    };

    /**
     *  Return a random natural
     *
     *  NOTE the max and min are INCLUDED in the range. So:
     *  chance.natural({min: 1, max: 3});
     *  would return either 1, 2, or 3.
     *
     *  @param {Object} [options={}] can specify a min and/or max
     *  @returns {Number} a single random integer number
     *  @throws {RangeError} min cannot be greater than max
     */
    Chance.prototype.natural = function (options) {
        options = initOptions(options, {min: 0, max: MAX_INT});
        testRange(options.min < 0, "Chance: Min cannot be less than zero.");
        return this.integer(options);
    };

    /**
     *  Return a random string
     *
     *  @param {Object} [options={}] can specify a length
     *  @returns {String} a string of random length
     *  @throws {RangeError} length cannot be less than zero
     */
    Chance.prototype.string = function (options) {
        options = initOptions(options, { length: this.natural({min: 5, max: 20}) });
        testRange(options.length < 0, "Chance: Length cannot be less than zero.");
        var length = options.length,
            text = this.n(this.character, length, options);

        return text.join("");
    };

    // -- End Basics --

    // -- Helpers --

    Chance.prototype.capitalize = function (word) {
        return word.charAt(0).toUpperCase() + word.substr(1);
    };

    Chance.prototype.mixin = function (obj) {
        for (var func_name in obj) {
            Chance.prototype[func_name] = obj[func_name];
        }
        return this;
    };

    /**
     *  Given a function that generates something random and a number of items to generate,
     *    return an array of items where none repeat.
     *
     *  @param {Function} fn the function that generates something random
     *  @param {Number} num number of terms to generate
     *  @param {Object} options any options to pass on to the generator function
     *  @returns {Array} an array of length `num` with every item generated by `fn` and unique
     *
     *  There can be more parameters after these. All additional parameters are provided to the given function
     */
    Chance.prototype.unique = function(fn, num, options) {
        testRange(
            typeof fn !== "function",
            "Chance: The first argument must be a function."
        );

        options = initOptions(options, {
            // Default comparator to check that val is not already in arr.
            // Should return `false` if item not in array, `true` otherwise
            comparator: function(arr, val) {
                return arr.indexOf(val) !== -1;
            }
        });

        var arr = [], count = 0, result, MAX_DUPLICATES = num * 50, params = slice.call(arguments, 2);

        while (arr.length < num) {
            result = fn.apply(this, params);
            if (!options.comparator(arr, result)) {
                arr.push(result);
                // reset count when unique found
                count = 0;
            }

            if (++count > MAX_DUPLICATES) {
                throw new RangeError("Chance: num is likely too large for sample set");
            }
        }
        return arr;
    };

    /**
     *  Gives an array of n random terms
     *
     *  @param {Function} fn the function that generates something random
     *  @param {Number} n number of terms to generate
     *  @returns {Array} an array of length `n` with items generated by `fn`
     *
     *  There can be more parameters after these. All additional parameters are provided to the given function
     */
    Chance.prototype.n = function(fn, n) {
        testRange(
            typeof fn !== "function",
            "Chance: The first argument must be a function."
        );

        if (typeof n === 'undefined') {
            n = 1;
        }
        var i = n, arr = [], params = slice.call(arguments, 2);

        // Providing a negative count should result in a noop.
        i = Math.max( 0, i );

        for (null; i--; null) {
            arr.push(fn.apply(this, params));
        }

        return arr;
    };

    // H/T to SO for this one: http://vq.io/OtUrZ5
    Chance.prototype.pad = function (number, width, pad) {
        // Default pad to 0 if none provided
        pad = pad || '0';
        // Convert number to a string
        number = number + '';
        return number.length >= width ? number : new Array(width - number.length + 1).join(pad) + number;
    };

    Chance.prototype.pick = function (arr, count) {
        if (arr.length === 0) {
            throw new RangeError("Chance: Cannot pick() from an empty array");
        }
        if (!count || count === 1) {
            return arr[this.natural({max: arr.length - 1})];
        } else {
            return this.shuffle(arr).slice(0, count);
        }
    };

    Chance.prototype.shuffle = function (arr) {
        var old_array = arr.slice(0),
            new_array = [],
            j = 0,
            length = Number(old_array.length);

        for (var i = 0; i < length; i++) {
            // Pick a random index from the array
            j = this.natural({max: old_array.length - 1});
            // Add it to the new array
            new_array[i] = old_array[j];
            // Remove that element from the original array
            old_array.splice(j, 1);
        }

        return new_array;
    };

    // Returns a single item from an array with relative weighting of odds
    Chance.prototype.weighted = function(arr, weights) {
        if (arr.length !== weights.length) {
            throw new RangeError("Chance: length of array and weights must match");
        }

        // Handle weights that are less or equal to zero.
        for (var weightIndex = weights.length - 1; weightIndex >= 0; --weightIndex) {
            // If the weight is less or equal to zero, remove it and the value.
            if (weights[weightIndex] <= 0) {
                arr.splice(weightIndex,1);
                weights.splice(weightIndex,1);
            }
        }

        // If any of the weights are less than 1, we want to scale them up to whole
        //   numbers for the rest of this logic to work
        if (weights.some(function(weight) { return weight < 1; })) {
            var min = weights.reduce(function(min, weight) {
                return (weight < min) ? weight : min;
            }, weights[0]);

            var scaling_factor = 1 / min;

            weights = weights.map(function(weight) {
                return weight * scaling_factor;
            });
        }

        var sum = weights.reduce(function(total, weight) {
            return total + weight;
        }, 0);

        // get an index
        var selected = this.natural({ min: 1, max: sum });

        var total = 0;
        var chosen;
        // Using some() here so we can bail as soon as we get our match
        weights.some(function(weight, index) {
            if (selected <= total + weight) {
                chosen = arr[index];
                return true;
            }
            total += weight;
            return false;
        });

        return chosen;
    };

    // -- End Helpers --

    // -- Text --

    Chance.prototype.paragraph = function (options) {
        options = initOptions(options);

        var sentences = options.sentences || this.natural({min: 3, max: 7}),
            sentence_array = this.n(this.sentence, sentences);

        return sentence_array.join(' ');
    };

    // Could get smarter about this than generating random words and
    // chaining them together. Such as: http://vq.io/1a5ceOh
    Chance.prototype.sentence = function (options) {
        options = initOptions(options);

        var words = options.words || this.natural({min: 12, max: 18}),
            punctuation = options.punctuation,
            text, word_array = this.n(this.word, words);

        text = word_array.join(' ');
        
        // Capitalize first letter of sentence
        text = this.capitalize(text);
        
        // Make sure punctuation has a usable value
        if (punctuation !== false && !/^[\.\?;!:]$/.test(punctuation)) {
            punctuation = '.';
        }
        
        // Add punctuation mark
        if (punctuation) {
            text += punctuation;
        }

        return text;
    };

    Chance.prototype.syllable = function (options) {
        options = initOptions(options);

        var length = options.length || this.natural({min: 2, max: 3}),
            consonants = 'bcdfghjklmnprstvwz', // consonants except hard to speak ones
            vowels = 'aeiou', // vowels
            all = consonants + vowels, // all
            text = '',
            chr;

        // I'm sure there's a more elegant way to do this, but this works
        // decently well.
        for (var i = 0; i < length; i++) {
            if (i === 0) {
                // First character can be anything
                chr = this.character({pool: all});
            } else if (consonants.indexOf(chr) === -1) {
                // Last character was a vowel, now we want a consonant
                chr = this.character({pool: consonants});
            } else {
                // Last character was a consonant, now we want a vowel
                chr = this.character({pool: vowels});
            }

            text += chr;
        }

        return text;
    };

    Chance.prototype.word = function (options) {
        options = initOptions(options);

        testRange(
            options.syllables && options.length,
            "Chance: Cannot specify both syllables AND length."
        );

        var syllables = options.syllables || this.natural({min: 1, max: 3}),
            text = '';

        if (options.length) {
            // Either bound word by length
            do {
                text += this.syllable();
            } while (text.length < options.length);
            text = text.substring(0, options.length);
        } else {
            // Or by number of syllables
            for (var i = 0; i < syllables; i++) {
                text += this.syllable();
            }
        }
        return text;
    };

    // -- End Text --

    // -- Person --

    Chance.prototype.age = function (options) {
        options = initOptions(options);
        var ageRange;

        switch (options.type) {
            case 'child':
                ageRange = {min: 1, max: 12};
                break;
            case 'teen':
                ageRange = {min: 13, max: 19};
                break;
            case 'adult':
                ageRange = {min: 18, max: 65};
                break;
            case 'senior':
                ageRange = {min: 65, max: 100};
                break;
            case 'all':
                ageRange = {min: 1, max: 100};
                break;
            default:
                ageRange = {min: 18, max: 65};
                break;
        }

        return this.natural(ageRange);
    };

    Chance.prototype.birthday = function (options) {
        options = initOptions(options, {
            year: (new Date().getFullYear() - this.age(options))
        });

        return this.date(options);
    };

    // CPF; ID to identify taxpayers in Brazil
    Chance.prototype.cpf = function () {
        var n = this.n(this.natural, 9, { max: 9 });
        var d1 = n[8]*2+n[7]*3+n[6]*4+n[5]*5+n[4]*6+n[3]*7+n[2]*8+n[1]*9+n[0]*10;
        d1 = 11 - (d1 % 11);
        if (d1>=10) {
            d1 = 0;
        }
        var d2 = d1*2+n[8]*3+n[7]*4+n[6]*5+n[5]*6+n[4]*7+n[3]*8+n[2]*9+n[1]*10+n[0]*11;
        d2 = 11 - (d2 % 11);
        if (d2>=10) {
            d2 = 0;
        }
        return ''+n[0]+n[1]+n[2]+'.'+n[3]+n[4]+n[5]+'.'+n[6]+n[7]+n[8]+'-'+d1+d2;
    };

    Chance.prototype.first = function (options) {
        options = initOptions(options, {gender: this.gender()});
        return this.pick(this.get("firstNames")[options.gender.toLowerCase()]);
    };

    Chance.prototype.gender = function () {
        return this.pick(['Male', 'Female']);
    };

    Chance.prototype.last = function () {
        return this.pick(this.get("lastNames"));
    };
    
    Chance.prototype.israelId=function(){
        var x=this.string({pool: '0123456789',length:8});
        var y=0;
        for (var i=0;i<x.length;i++){
            var thisDigit=  x[i] *  (i/2===parseInt(i/2) ? 1 : 2);
            thisDigit=this.pad(thisDigit,2).toString();
            thisDigit=parseInt(thisDigit[0]) + parseInt(thisDigit[1]);
            y=y+thisDigit;
        }
        x=x+(10-parseInt(y.toString().slice(-1))).toString().slice(-1);
        return x;
    };

    Chance.prototype.mrz = function (options) {
        var checkDigit = function (input) {
            var alpha = "<ABCDEFGHIJKLMNOPQRSTUVWXYXZ".split(''),
                multipliers = [ 7, 3, 1 ],
                runningTotal = 0;

            if (typeof input !== 'string') {
                input = input.toString();
            }

            input.split('').forEach(function(character, idx) {
                var pos = alpha.indexOf(character);

                if(pos !== -1) {
                    character = pos === 0 ? 0 : pos + 9;
                } else {
                    character = parseInt(character, 10);
                }
                character *= multipliers[idx % multipliers.length];
                runningTotal += character;
            });
            return runningTotal % 10;
        };
        var generate = function (opts) {
            var pad = function (length) {
                return new Array(length + 1).join('<');
            };
            var number = [ 'P<',
                           opts.issuer,
                           opts.last.toUpperCase(),
                           '<<',
                           opts.first.toUpperCase(),
                           pad(39 - (opts.last.length + opts.first.length + 2)),
                           opts.passportNumber,
                           checkDigit(opts.passportNumber),
                           opts.nationality,
                           opts.dob,
                           checkDigit(opts.dob),
                           opts.gender,
                           opts.expiry,
                           checkDigit(opts.expiry),
                           pad(14),
                           checkDigit(pad(14)) ].join('');

            return number +
                (checkDigit(number.substr(44, 10) +
                            number.substr(57, 7) +
                            number.substr(65, 7)));
        };

        var that = this;

        options = initOptions(options, {
            first: this.first(),
            last: this.last(),
            passportNumber: this.integer({min: 100000000, max: 999999999}),
            dob: (function () {
                var date = that.birthday({type: 'adult'});
                return [date.getFullYear().toString().substr(2),
                        that.pad(date.getMonth() + 1, 2),
                        that.pad(date.getDate(), 2)].join('');
            }()),
            expiry: (function () {
                var date = new Date();
                return [(date.getFullYear() + 5).toString().substr(2),
                        that.pad(date.getMonth() + 1, 2),
                        that.pad(date.getDate(), 2)].join('');
            }()),
            gender: this.gender() === 'Female' ? 'F': 'M',
            issuer: 'GBR',
            nationality: 'GBR'
        });
        return generate (options);
    };

    Chance.prototype.name = function (options) {
        options = initOptions(options);

        var first = this.first(options),
            last = this.last(),
            name;

        if (options.middle) {
            name = first + ' ' + this.first(options) + ' ' + last;
        } else if (options.middle_initial) {
            name = first + ' ' + this.character({alpha: true, casing: 'upper'}) + '. ' + last;
        } else {
            name = first + ' ' + last;
        }

        if (options.prefix) {
            name = this.prefix(options) + ' ' + name;
        }

        if (options.suffix) {
            name = name + ' ' + this.suffix(options);
        }

        return name;
    };

    // Return the list of available name prefixes based on supplied gender.
    Chance.prototype.name_prefixes = function (gender) {
        gender = gender || "all";
        gender = gender.toLowerCase();

        var prefixes = [
            { name: 'Doctor', abbreviation: 'Dr.' }
        ];

        if (gender === "male" || gender === "all") {
            prefixes.push({ name: 'Mister', abbreviation: 'Mr.' });
        }

        if (gender === "female" || gender === "all") {
            prefixes.push({ name: 'Miss', abbreviation: 'Miss' });
            prefixes.push({ name: 'Misses', abbreviation: 'Mrs.' });
        }

        return prefixes;
    };

    // Alias for name_prefix
    Chance.prototype.prefix = function (options) {
        return this.name_prefix(options);
    };

    Chance.prototype.name_prefix = function (options) {
        options = initOptions(options, { gender: "all" });
        return options.full ?
            this.pick(this.name_prefixes(options.gender)).name :
            this.pick(this.name_prefixes(options.gender)).abbreviation;
    };

    Chance.prototype.ssn = function (options) {
        options = initOptions(options, {ssnFour: false, dashes: true});
        var ssn_pool = "1234567890",
            ssn,
            dash = options.dashes ? '-' : '';

        if(!options.ssnFour) {
            ssn = this.string({pool: ssn_pool, length: 3}) + dash +
            this.string({pool: ssn_pool, length: 2}) + dash +
            this.string({pool: ssn_pool, length: 4});
        } else {
            ssn = this.string({pool: ssn_pool, length: 4});
        }
        return ssn;
    };

    // Return the list of available name suffixes
    Chance.prototype.name_suffixes = function () {
        var suffixes = [
            { name: 'Doctor of Osteopathic Medicine', abbreviation: 'D.O.' },
            { name: 'Doctor of Philosophy', abbreviation: 'Ph.D.' },
            { name: 'Esquire', abbreviation: 'Esq.' },
            { name: 'Junior', abbreviation: 'Jr.' },
            { name: 'Juris Doctor', abbreviation: 'J.D.' },
            { name: 'Master of Arts', abbreviation: 'M.A.' },
            { name: 'Master of Business Administration', abbreviation: 'M.B.A.' },
            { name: 'Master of Science', abbreviation: 'M.S.' },
            { name: 'Medical Doctor', abbreviation: 'M.D.' },
            { name: 'Senior', abbreviation: 'Sr.' },
            { name: 'The Third', abbreviation: 'III' },
            { name: 'The Fourth', abbreviation: 'IV' },
            { name: 'Bachelor of Engineering', abbreviation: 'B.E' },
            { name: 'Bachelor of Technology', abbreviation: 'B.TECH' }
        ];
        return suffixes;
    };

    // Alias for name_suffix
    Chance.prototype.suffix = function (options) {
        return this.name_suffix(options);
    };

    Chance.prototype.name_suffix = function (options) {
        options = initOptions(options);
        return options.full ?
            this.pick(this.name_suffixes()).name :
            this.pick(this.name_suffixes()).abbreviation;
    };

    // -- End Person --

    // -- Mobile --
    // Android GCM Registration ID
    Chance.prototype.android_id = function () {
        return "APA91" + this.string({ pool: "0123456789abcefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_", length: 178 });
    };

    // Apple Push Token
    Chance.prototype.apple_token = function () {
        return this.string({ pool: "abcdef1234567890", length: 64 });
    };

    // Windows Phone 8 ANID2
    Chance.prototype.wp8_anid2 = function () {
        return base64( this.hash( { length : 32 } ) );
    };

    // Windows Phone 7 ANID
    Chance.prototype.wp7_anid = function () {
        return 'A=' + this.guid().replace(/-/g, '').toUpperCase() + '&E=' + this.hash({ length:3 }) + '&W=' + this.integer({ min:0, max:9 });
    };

    // BlackBerry Device PIN
    Chance.prototype.bb_pin = function () {
        return this.hash({ length: 8 });
    };

    // -- End Mobile --

    // -- Web --
    Chance.prototype.avatar = function (options) {
        var url = null;
        var URL_BASE = '//www.gravatar.com/avatar/';
        var PROTOCOLS = {
            http: 'http',
            https: 'https'
        };
        var FILE_TYPES = {
            bmp: 'bmp',
            gif: 'gif',
            jpg: 'jpg',
            png: 'png'
        };
        var FALLBACKS = {
            '404': '404', // Return 404 if not found
            mm: 'mm', // Mystery man
            identicon: 'identicon', // Geometric pattern based on hash
            monsterid: 'monsterid', // A generated monster icon
            wavatar: 'wavatar', // A generated face
            retro: 'retro', // 8-bit icon
            blank: 'blank' // A transparent png
        };
        var RATINGS = {
            g: 'g',
            pg: 'pg',
            r: 'r',
            x: 'x'
        };
        var opts = {
            protocol: null,
            email: null,
            fileExtension: null,
            size: null,
            fallback: null,
            rating: null
        };

        if (!options) {
            // Set to a random email
            opts.email = this.email();
            options = {};
        }
        else if (typeof options === 'string') {
            opts.email = options;
            options = {};
        }
        else if (typeof options !== 'object') {
            return null;
        }
        else if (options.constructor === 'Array') {
            return null;
        }

        opts = initOptions(options, opts);

        if (!opts.email) {
            // Set to a random email
            opts.email = this.email();
        }

        // Safe checking for params
        opts.protocol = PROTOCOLS[opts.protocol] ? opts.protocol + ':' : '';
        opts.size = parseInt(opts.size, 0) ? opts.size : '';
        opts.rating = RATINGS[opts.rating] ? opts.rating : '';
        opts.fallback = FALLBACKS[opts.fallback] ? opts.fallback : '';
        opts.fileExtension = FILE_TYPES[opts.fileExtension] ? opts.fileExtension : '';

        url =
            opts.protocol +
            URL_BASE +
            this.bimd5.md5(opts.email) +
            (opts.fileExtension ? '.' + opts.fileExtension : '') +
            (opts.size || opts.rating || opts.fallback ? '?' : '') +
            (opts.size ? '&s=' + opts.size.toString() : '') +
            (opts.rating ? '&r=' + opts.rating : '') +
            (opts.fallback ? '&d=' + opts.fallback : '')
            ;

        return url;
    };

    Chance.prototype.color = function (options) {
        function gray(value, delimiter) {
            return [value, value, value].join(delimiter || '');
        }

        options = initOptions(options, {
            format: this.pick(['hex', 'shorthex', 'rgb', 'rgba', '0x']),
            grayscale: false,
            casing: 'lower'
        });

        var isGrayscale = options.grayscale;
        var colorValue;

        if (options.format === 'hex') {
            colorValue = '#' + (isGrayscale ? gray(this.hash({length: 2})) : this.hash({length: 6}));

        } else if (options.format === 'shorthex') {
            colorValue = '#' + (isGrayscale ? gray(this.hash({length: 1})) : this.hash({length: 3}));

        } else if (options.format === 'rgb') {
            if (isGrayscale) {
                colorValue = 'rgb(' + gray(this.natural({max: 255}), ',') + ')';
            } else {
                colorValue = 'rgb(' + this.natural({max: 255}) + ',' + this.natural({max: 255}) + ',' + this.natural({max: 255}) + ')';
            }
        } else if (options.format === 'rgba') {
            if (isGrayscale) {
                colorValue = 'rgba(' + gray(this.natural({max: 255}), ',') + ',' + this.floating({min:0, max:1}) + ')';
            } else {
                colorValue = 'rgba(' + this.natural({max: 255}) + ',' + this.natural({max: 255}) + ',' + this.natural({max: 255}) + ',' + this.floating({min:0, max:1}) + ')';
            }
        } else if (options.format === '0x') {
            colorValue = '0x' + (isGrayscale ? gray(this.hash({length: 2})) : this.hash({length: 6}));
        } else {
            throw new RangeError('Invalid format provided. Please provide one of "hex", "shorthex", "rgb", "rgba", or "0x".');
        }

        if (options.casing === 'upper' ) {
            colorValue = colorValue.toUpperCase();
        }

        return colorValue;
    };

    Chance.prototype.domain = function (options) {
        options = initOptions(options);
        return this.word() + '.' + (options.tld || this.tld());
    };

    Chance.prototype.email = function (options) {
        options = initOptions(options);
        return this.word({length: options.length}) + '@' + (options.domain || this.domain());
    };

    Chance.prototype.fbid = function () {
        return parseInt('10000' + this.natural({max: 100000000000}), 10);
    };

    Chance.prototype.google_analytics = function () {
        var account = this.pad(this.natural({max: 999999}), 6);
        var property = this.pad(this.natural({max: 99}), 2);

        return 'UA-' + account + '-' + property;
    };

    Chance.prototype.hashtag = function () {
        return '#' + this.word();
    };

    Chance.prototype.ip = function () {
        // Todo: This could return some reserved IPs. See http://vq.io/137dgYy
        // this should probably be updated to account for that rare as it may be
        return this.natural({max: 255}) + '.' +
               this.natural({max: 255}) + '.' +
               this.natural({max: 255}) + '.' +
               this.natural({max: 255});
    };

    Chance.prototype.ipv6 = function () {
        var ip_addr = this.n(this.hash, 8, {length: 4});

        return ip_addr.join(":");
    };

    Chance.prototype.klout = function () {
        return this.natural({min: 1, max: 99});
    };

    Chance.prototype.tlds = function () {
        return ['com', 'org', 'edu', 'gov', 'co.uk', 'net', 'io'];
    };

    Chance.prototype.tld = function () {
        return this.pick(this.tlds());
    };

    Chance.prototype.twitter = function () {
        return '@' + this.word();
    };

    Chance.prototype.url = function (options) {
        options = initOptions(options, { protocol: "http", domain: this.domain(options), domain_prefix: "", path: this.word(), extensions: []});

        var extension = options.extensions.length > 0 ? "." + this.pick(options.extensions) : "";
        var domain = options.domain_prefix ? options.domain_prefix + "." + options.domain : options.domain;

        return options.protocol + "://" + domain + "/" + options.path + extension;
    };

    // -- End Web --

    // -- Location --

    Chance.prototype.address = function (options) {
        options = initOptions(options);
        return this.natural({min: 5, max: 2000}) + ' ' + this.street(options);
    };

    Chance.prototype.altitude = function (options) {
        options = initOptions(options, {fixed: 5, min: 0, max: 8848});
        return this.floating({
            min: options.min,
            max: options.max,
            fixed: options.fixed
        });
    };

    Chance.prototype.areacode = function (options) {
        options = initOptions(options, {parens : true});
        // Don't want area codes to start with 1, or have a 9 as the second digit
        var areacode = this.natural({min: 2, max: 9}).toString() +
                this.natural({min: 0, max: 8}).toString() +
                this.natural({min: 0, max: 9}).toString();

        return options.parens ? '(' + areacode + ')' : areacode;
    };

    Chance.prototype.city = function () {
        return this.capitalize(this.word({syllables: 3}));
    };

    Chance.prototype.coordinates = function (options) {
        return this.latitude(options) + ', ' + this.longitude(options);
    };

    Chance.prototype.countries = function () {
        return this.get("countries");
    };

    Chance.prototype.country = function (options) {
        options = initOptions(options);
        var country = this.pick(this.countries());
        return options.full ? country.name : country.abbreviation;
    };

    Chance.prototype.depth = function (options) {
        options = initOptions(options, {fixed: 5, min: -10994, max: 0});
        return this.floating({
            min: options.min,
            max: options.max,
            fixed: options.fixed
        });
    };

    Chance.prototype.geohash = function (options) {
        options = initOptions(options, { length: 7 });
        return this.string({ length: options.length, pool: '0123456789bcdefghjkmnpqrstuvwxyz' });
    };

    Chance.prototype.geojson = function (options) {
        return this.latitude(options) + ', ' + this.longitude(options) + ', ' + this.altitude(options);
    };

    Chance.prototype.latitude = function (options) {
        options = initOptions(options, {fixed: 5, min: -90, max: 90});
        return this.floating({min: options.min, max: options.max, fixed: options.fixed});
    };

    Chance.prototype.longitude = function (options) {
        options = initOptions(options, {fixed: 5, min: -180, max: 180});
        return this.floating({min: options.min, max: options.max, fixed: options.fixed});
    };

    Chance.prototype.phone = function (options) {
        var self = this,
            numPick,
            ukNum = function (parts) {
                var section = [];
                //fills the section part of the phone number with random numbers.
                parts.sections.forEach(function(n) {
                    section.push(self.string({ pool: '0123456789', length: n}));
                });
                return parts.area + section.join(' ');
            };
        options = initOptions(options, {
            formatted: true,
            country: 'us',
            mobile: false
        });
        if (!options.formatted) {
            options.parens = false;
        }
        var phone;
        switch (options.country) {
            case 'fr':
                if (!options.mobile) {
                    numPick = this.pick([
                        // Valid zone and département codes.
                        '01' + this.pick(['30', '34', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '53', '55', '56', '58', '60', '64', '69', '70', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83']) + self.string({ pool: '0123456789', length: 6}),
                        '02' + this.pick(['14', '18', '22', '23', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '40', '41', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53', '54', '56', '57', '61', '62', '69', '72', '76', '77', '78', '85', '90', '96', '97', '98', '99']) + self.string({ pool: '0123456789', length: 6}),
                        '03' + this.pick(['10', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '39', '44', '45', '51', '52', '54', '55', '57', '58', '59', '60', '61', '62', '63', '64', '65', '66', '67', '68', '69', '70', '71', '72', '73', '80', '81', '82', '83', '84', '85', '86', '87', '88', '89', '90']) + self.string({ pool: '0123456789', length: 6}),
                        '04' + this.pick(['11', '13', '15', '20', '22', '26', '27', '30', '32', '34', '37', '42', '43', '44', '50', '56', '57', '63', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76', '77', '78', '79', '80', '81', '82', '83', '84', '85', '86', '88', '89', '90', '91', '92', '93', '94', '95', '97', '98']) + self.string({ pool: '0123456789', length: 6}),
                        '05' + this.pick(['08', '16', '17', '19', '24', '31', '32', '33', '34', '35', '40', '45', '46', '47', '49', '53', '55', '56', '57', '58', '59', '61', '62', '63', '64', '65', '67', '79', '81', '82', '86', '87', '90', '94']) + self.string({ pool: '0123456789', length: 6}),
                        '09' + self.string({ pool: '0123456789', length: 8}),
                    ]);
                    phone = options.formatted ? numPick.match(/../g).join(' ') : numPick;
                } else {
                    numPick = this.pick(['06', '07']) + self.string({ pool: '0123456789', length: 8});
                    phone = options.formatted ? numPick.match(/../g).join(' ') : numPick;
                }
                break;
            case 'uk':
                if (!options.mobile) {
                    numPick = this.pick([
                        //valid area codes of major cities/counties followed by random numbers in required format.
                        { area: '01' + this.character({ pool: '234569' }) + '1 ', sections: [3,4] },
                        { area: '020 ' + this.character({ pool: '378' }), sections: [3,4] },
                        { area: '023 ' + this.character({ pool: '89' }), sections: [3,4] },
                        { area: '024 7', sections: [3,4] },
                        { area: '028 ' + this.pick(['25','28','37','71','82','90','92','95']), sections: [2,4] },
                        { area: '012' + this.pick(['04','08','54','76','97','98']) + ' ', sections: [5] },
                        { area: '013' + this.pick(['63','64','84','86']) + ' ', sections: [5] },
                        { area: '014' + this.pick(['04','20','60','61','80','88']) + ' ', sections: [5] },
                        { area: '015' + this.pick(['24','27','62','66']) + ' ', sections: [5] },
                        { area: '016' + this.pick(['06','29','35','47','59','95']) + ' ', sections: [5] },
                        { area: '017' + this.pick(['26','44','50','68']) + ' ', sections: [5] },
                        { area: '018' + this.pick(['27','37','84','97']) + ' ', sections: [5] },
                        { area: '019' + this.pick(['00','05','35','46','49','63','95']) + ' ', sections: [5] }
                    ]);
                    phone = options.formatted ? ukNum(numPick) : ukNum(numPick).replace(' ', '', 'g');
                } else {
                    numPick = this.pick([
                        { area: '07' + this.pick(['4','5','7','8','9']), sections: [2,6] },
                        { area: '07624 ', sections: [6] }
                    ]);
                    phone = options.formatted ? ukNum(numPick) : ukNum(numPick).replace(' ', '');
                }
                break;
            case 'us':
                var areacode = this.areacode(options).toString();
                var exchange = this.natural({ min: 2, max: 9 }).toString() +
                    this.natural({ min: 0, max: 9 }).toString() +
                    this.natural({ min: 0, max: 9 }).toString();
                var subscriber = this.natural({ min: 1000, max: 9999 }).toString(); // this could be random [0-9]{4}
                phone = options.formatted ? areacode + ' ' + exchange + '-' + subscriber : areacode + exchange + subscriber;
        }
        return phone;
    };

    Chance.prototype.postal = function () {
        // Postal District
        var pd = this.character({pool: "XVTSRPNKLMHJGECBA"});
        // Forward Sortation Area (FSA)
        var fsa = pd + this.natural({max: 9}) + this.character({alpha: true, casing: "upper"});
        // Local Delivery Unut (LDU)
        var ldu = this.natural({max: 9}) + this.character({alpha: true, casing: "upper"}) + this.natural({max: 9});

        return fsa + " " + ldu;
    };

    Chance.prototype.provinces = function () {
        return this.get("provinces");
    };

    Chance.prototype.province = function (options) {
        return (options && options.full) ?
            this.pick(this.provinces()).name :
            this.pick(this.provinces()).abbreviation;
    };

    Chance.prototype.state = function (options) {
        return (options && options.full) ?
            this.pick(this.states(options)).name :
            this.pick(this.states(options)).abbreviation;
    };

    Chance.prototype.states = function (options) {
        options = initOptions(options, { us_states_and_dc: true });

        var states,
            us_states_and_dc = this.get("us_states_and_dc"),
            territories = this.get("territories"),
            armed_forces = this.get("armed_forces");

        states = [];

        if (options.us_states_and_dc) {
            states = states.concat(us_states_and_dc);
        }
        if (options.territories) {
            states = states.concat(territories);
        }
        if (options.armed_forces) {
            states = states.concat(armed_forces);
        }

        return states;
    };

    Chance.prototype.street = function (options) {
        options = initOptions(options);

        var street = this.word({syllables: 2});
        street = this.capitalize(street);
        street += ' ';
        street += options.short_suffix ?
            this.street_suffix().abbreviation :
            this.street_suffix().name;
        return street;
    };

    Chance.prototype.street_suffix = function () {
        return this.pick(this.street_suffixes());
    };

    Chance.prototype.street_suffixes = function () {
        // These are the most common suffixes.
        return this.get("street_suffixes");
    };

    // Note: only returning US zip codes, internationalization will be a whole
    // other beast to tackle at some point.
    Chance.prototype.zip = function (options) {
        var zip = this.n(this.natural, 5, {max: 9});

        if (options && options.plusfour === true) {
            zip.push('-');
            zip = zip.concat(this.n(this.natural, 4, {max: 9}));
        }

        return zip.join("");
    };

    // -- End Location --

    // -- Time

    Chance.prototype.ampm = function () {
        return this.bool() ? 'am' : 'pm';
    };

    Chance.prototype.date = function (options) {
        var date_string, date;

        // If interval is specified we ignore preset
        if(options && (options.min || options.max)) {
            options = initOptions(options, {
                american: true,
                string: false
            });
            var min = typeof options.min !== "undefined" ? options.min.getTime() : 1;
            // 100,000,000 days measured relative to midnight at the beginning of 01 January, 1970 UTC. http://es5.github.io/#x15.9.1.1
            var max = typeof options.max !== "undefined" ? options.max.getTime() : 8640000000000000;

            date = new Date(this.natural({min: min, max: max}));
        } else {
            var m = this.month({raw: true});
            var daysInMonth = m.days;

            if(options && options.month) {
                // Mod 12 to allow months outside range of 0-11 (not encouraged, but also not prevented).
                daysInMonth = this.get('months')[((options.month % 12) + 12) % 12].days;
            }

            options = initOptions(options, {
                year: parseInt(this.year(), 10),
                // Necessary to subtract 1 because Date() 0-indexes month but not day or year
                // for some reason.
                month: m.numeric - 1,
                day: this.natural({min: 1, max: daysInMonth}),
                hour: this.hour(),
                minute: this.minute(),
                second: this.second(),
                millisecond: this.millisecond(),
                american: true,
                string: false
            });

            date = new Date(options.year, options.month, options.day, options.hour, options.minute, options.second, options.millisecond);
        }

        if (options.american) {
            // Adding 1 to the month is necessary because Date() 0-indexes
            // months but not day for some odd reason.
            date_string = (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear();
        } else {
            date_string = date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear();
        }

        return options.string ? date_string : date;
    };

    Chance.prototype.hammertime = function (options) {
        return this.date(options).getTime();
    };

    Chance.prototype.hour = function (options) {
        options = initOptions(options, {min: 1, max: options && options.twentyfour ? 24 : 12});

        testRange(options.min < 1, "Chance: Min cannot be less than 1.");
        testRange(options.twentyfour && options.max > 24, "Chance: Max cannot be greater than 24 for twentyfour option.");
        testRange(!options.twentyfour && options.max > 12, "Chance: Max cannot be greater than 12.");
        testRange(options.min > options.max, "Chance: Min cannot be greater than Max.");

        return this.natural({min: options.min, max: options.max});
    };

    Chance.prototype.millisecond = function () {
        return this.natural({max: 999});
    };

    Chance.prototype.minute = Chance.prototype.second = function (options) {
        options = initOptions(options, {min: 0, max: 59});

        testRange(options.min < 0, "Chance: Min cannot be less than 0.");
        testRange(options.max > 59, "Chance: Max cannot be greater than 59.");
        testRange(options.min > options.max, "Chance: Min cannot be greater than Max.");

        return this.natural({min: options.min, max: options.max});
    };

    Chance.prototype.month = function (options) {
        options = initOptions(options, {min: 1, max: 12});

        testRange(options.min < 1, "Chance: Min cannot be less than 1.");
        testRange(options.max > 12, "Chance: Max cannot be greater than 12.");
        testRange(options.min > options.max, "Chance: Min cannot be greater than Max.");

        var month = this.pick(this.months().slice(options.min - 1, options.max));
        return options.raw ? month : month.name;
    };

    Chance.prototype.months = function () {
        return this.get("months");
    };

    Chance.prototype.second = function () {
        return this.natural({max: 59});
    };

    Chance.prototype.timestamp = function () {
        return this.natural({min: 1, max: parseInt(new Date().getTime() / 1000, 10)});
    };

    Chance.prototype.year = function (options) {
        // Default to current year as min if none specified
        options = initOptions(options, {min: new Date().getFullYear()});

        // Default to one century after current year as max if none specified
        options.max = (typeof options.max !== "undefined") ? options.max : options.min + 100;

        return this.natural(options).toString();
    };

    // -- End Time

    // -- Finance --

    Chance.prototype.cc = function (options) {
        options = initOptions(options);

        var type, number, to_generate;

        type = (options.type) ?
                    this.cc_type({ name: options.type, raw: true }) :
                    this.cc_type({ raw: true });

        number = type.prefix.split("");
        to_generate = type.length - type.prefix.length - 1;

        // Generates n - 1 digits
        number = number.concat(this.n(this.integer, to_generate, {min: 0, max: 9}));

        // Generates the last digit according to Luhn algorithm
        number.push(this.luhn_calculate(number.join("")));

        return number.join("");
    };

    Chance.prototype.cc_types = function () {
        // http://en.wikipedia.org/wiki/Bank_card_number#Issuer_identification_number_.28IIN.29
        return this.get("cc_types");
    };

    Chance.prototype.cc_type = function (options) {
        options = initOptions(options);
        var types = this.cc_types(),
            type = null;

        if (options.name) {
            for (var i = 0; i < types.length; i++) {
                // Accept either name or short_name to specify card type
                if (types[i].name === options.name || types[i].short_name === options.name) {
                    type = types[i];
                    break;
                }
            }
            if (type === null) {
                throw new RangeError("Credit card type '" + options.name + "'' is not supported");
            }
        } else {
            type = this.pick(types);
        }

        return options.raw ? type : type.name;
    };

    //return all world currency by ISO 4217
    Chance.prototype.currency_types = function () {
        return this.get("currency_types");
    };

    //return random world currency by ISO 4217
    Chance.prototype.currency = function () {
        return this.pick(this.currency_types());
    };

    //Return random correct currency exchange pair (e.g. EUR/USD) or array of currency code
    Chance.prototype.currency_pair = function (returnAsString) {
        var currencies = this.unique(this.currency, 2, {
            comparator: function(arr, val) {

                return arr.reduce(function(acc, item) {
                    // If a match has been found, short circuit check and just return
                    return acc || (item.code === val.code);
                }, false);
            }
        });

        if (returnAsString) {
            return currencies[0].code + '/' + currencies[1].code;
        } else {
            return currencies;
        }
    };

    Chance.prototype.dollar = function (options) {
        // By default, a somewhat more sane max for dollar than all available numbers
        options = initOptions(options, {max : 10000, min : 0});

        var dollar = this.floating({min: options.min, max: options.max, fixed: 2}).toString(),
            cents = dollar.split('.')[1];

        if (cents === undefined) {
            dollar += '.00';
        } else if (cents.length < 2) {
            dollar = dollar + '0';
        }

        if (dollar < 0) {
            return '-$' + dollar.replace('-', '');
        } else {
            return '$' + dollar;
        }
    };

    Chance.prototype.exp = function (options) {
        options = initOptions(options);
        var exp = {};

        exp.year = this.exp_year();

        // If the year is this year, need to ensure month is greater than the
        // current month or this expiration will not be valid
        if (exp.year === (new Date().getFullYear()).toString()) {
            exp.month = this.exp_month({future: true});
        } else {
            exp.month = this.exp_month();
        }

        return options.raw ? exp : exp.month + '/' + exp.year;
    };

    Chance.prototype.exp_month = function (options) {
        options = initOptions(options);
        var month, month_int,
            // Date object months are 0 indexed
            curMonth = new Date().getMonth() + 1;

        if (options.future) {
            do {
                month = this.month({raw: true}).numeric;
                month_int = parseInt(month, 10);
            } while (month_int <= curMonth);
        } else {
            month = this.month({raw: true}).numeric;
        }

        return month;
    };

    Chance.prototype.exp_year = function () {
        return this.year({max: new Date().getFullYear() + 10});
    };

    // -- End Finance

    // -- Regional

    Chance.prototype.pl_pesel = function () {
        var number = this.natural({min: 1, max: 9999999999});
        var arr = this.pad(number, 10).split('');
        for (var i = 0; i < arr.length; i++) {
            arr[i] = parseInt(arr[i]);
        }

        var controlNumber = (1 * arr[0] + 3 * arr[1] + 7 * arr[2] + 9 * arr[3] + 1 * arr[4] + 3 * arr[5] + 7 * arr[6] + 9 * arr[7] + 1 * arr[8] + 3 * arr[9]) % 10;
        if(controlNumber !== 0) {
            controlNumber = 10 - controlNumber;
        }

        return arr.join('') + controlNumber;
    };

    Chance.prototype.pl_nip = function () {
        var number = this.natural({min: 1, max: 999999999});
        var arr = this.pad(number, 9).split('');
        for (var i = 0; i < arr.length; i++) {
            arr[i] = parseInt(arr[i]);
        }

        var controlNumber = (6 * arr[0] + 5 * arr[1] + 7 * arr[2] + 2 * arr[3] + 3 * arr[4] + 4 * arr[5] + 5 * arr[6] + 6 * arr[7] + 7 * arr[8]) % 11;
        if(controlNumber === 10) {
            return this.pl_nip();
        }

        return arr.join('') + controlNumber;
    };

    Chance.prototype.pl_regon = function () {
        var number = this.natural({min: 1, max: 99999999});
        var arr = this.pad(number, 8).split('');
        for (var i = 0; i < arr.length; i++) {
            arr[i] = parseInt(arr[i]);
        }

        var controlNumber = (8 * arr[0] + 9 * arr[1] + 2 * arr[2] + 3 * arr[3] + 4 * arr[4] + 5 * arr[5] + 6 * arr[6] + 7 * arr[7]) % 11;
        if(controlNumber === 10) {
            controlNumber = 0;
        }

        return arr.join('') + controlNumber;
    };

    // -- End Regional

    // -- Miscellaneous --

    // Dice - For all the board game geeks out there, myself included ;)
    function diceFn (range) {
        return function () {
            return this.natural(range);
        };
    }
    Chance.prototype.d4 = diceFn({min: 1, max: 4});
    Chance.prototype.d6 = diceFn({min: 1, max: 6});
    Chance.prototype.d8 = diceFn({min: 1, max: 8});
    Chance.prototype.d10 = diceFn({min: 1, max: 10});
    Chance.prototype.d12 = diceFn({min: 1, max: 12});
    Chance.prototype.d20 = diceFn({min: 1, max: 20});
    Chance.prototype.d30 = diceFn({min: 1, max: 30});
    Chance.prototype.d100 = diceFn({min: 1, max: 100});

    Chance.prototype.rpg = function (thrown, options) {
        options = initOptions(options);
        if (!thrown) {
            throw new RangeError("A type of die roll must be included");
        } else {
            var bits = thrown.toLowerCase().split("d"),
                rolls = [];

            if (bits.length !== 2 || !parseInt(bits[0], 10) || !parseInt(bits[1], 10)) {
                throw new Error("Invalid format provided. Please provide #d# where the first # is the number of dice to roll, the second # is the max of each die");
            }
            for (var i = bits[0]; i > 0; i--) {
                rolls[i - 1] = this.natural({min: 1, max: bits[1]});
            }
            return (typeof options.sum !== 'undefined' && options.sum) ? rolls.reduce(function (p, c) { return p + c; }) : rolls;
        }
    };

    // Guid
    Chance.prototype.guid = function (options) {
        options = initOptions(options, { version: 5 });

        var guid_pool = "abcdef1234567890",
            variant_pool = "ab89",
            guid = this.string({ pool: guid_pool, length: 8 }) + '-' +
                   this.string({ pool: guid_pool, length: 4 }) + '-' +
                   // The Version
                   options.version +
                   this.string({ pool: guid_pool, length: 3 }) + '-' +
                   // The Variant
                   this.string({ pool: variant_pool, length: 1 }) +
                   this.string({ pool: guid_pool, length: 3 }) + '-' +
                   this.string({ pool: guid_pool, length: 12 });
        return guid;
    };

    // Hash
    Chance.prototype.hash = function (options) {
        options = initOptions(options, {length : 40, casing: 'lower'});
        var pool = options.casing === 'upper' ? HEX_POOL.toUpperCase() : HEX_POOL;
        return this.string({pool: pool, length: options.length});
    };

    Chance.prototype.luhn_check = function (num) {
        var str = num.toString();
        var checkDigit = +str.substring(str.length - 1);
        return checkDigit === this.luhn_calculate(+str.substring(0, str.length - 1));
    };

    Chance.prototype.luhn_calculate = function (num) {
        var digits = num.toString().split("").reverse();
        var sum = 0;
        var digit;

        for (var i = 0, l = digits.length; l > i; ++i) {
            digit = +digits[i];
            if (i % 2 === 0) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }
            sum += digit;
        }
        return (sum * 9) % 10;
    };

    // MD5 Hash
    Chance.prototype.md5 = function(options) {
        var opts = { str: '', key: null, raw: false };

        if (!options) {
            opts.str = this.string();
            options = {};
        }
        else if (typeof options === 'string') {
            opts.str = options;
            options = {};
        }
        else if (typeof options !== 'object') {
            return null;
        }
        else if(options.constructor === 'Array') {
            return null;
        }

        opts = initOptions(options, opts);

        if(!opts.str){
            throw new Error('A parameter is required to return an md5 hash.');
        }

        return this.bimd5.md5(opts.str, opts.key, opts.raw);
    };

    var data = {

        firstNames: {
            "male": ["James", "John", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Charles", "Thomas", "Christopher", "Daniel", "Matthew", "George", "Donald", "Anthony", "Paul", "Mark", "Edward", "Steven", "Kenneth", "Andrew", "Brian", "Joshua", "Kevin", "Ronald", "Timothy", "Jason", "Jeffrey", "Frank", "Gary", "Ryan", "Nicholas", "Eric", "Stephen", "Jacob", "Larry", "Jonathan", "Scott", "Raymond", "Justin", "Brandon", "Gregory", "Samuel", "Benjamin", "Patrick", "Jack", "Henry", "Walter", "Dennis", "Jerry", "Alexander", "Peter", "Tyler", "Douglas", "Harold", "Aaron", "Jose", "Adam", "Arthur", "Zachary", "Carl", "Nathan", "Albert", "Kyle", "Lawrence", "Joe", "Willie", "Gerald", "Roger", "Keith", "Jeremy", "Terry", "Harry", "Ralph", "Sean", "Jesse", "Roy", "Louis", "Billy", "Austin", "Bruce", "Eugene", "Christian", "Bryan", "Wayne", "Russell", "Howard", "Fred", "Ethan", "Jordan", "Philip", "Alan", "Juan", "Randy", "Vincent", "Bobby", "Dylan", "Johnny", "Phillip", "Victor", "Clarence", "Ernest", "Martin", "Craig", "Stanley", "Shawn", "Travis", "Bradley", "Leonard", "Earl", "Gabriel", "Jimmy", "Francis", "Todd", "Noah", "Danny", "Dale", "Cody", "Carlos", "Allen", "Frederick", "Logan", "Curtis", "Alex", "Joel", "Luis", "Norman", "Marvin", "Glenn", "Tony", "Nathaniel", "Rodney", "Melvin", "Alfred", "Steve", "Cameron", "Chad", "Edwin", "Caleb", "Evan", "Antonio", "Lee", "Herbert", "Jeffery", "Isaac", "Derek", "Ricky", "Marcus", "Theodore", "Elijah", "Luke", "Jesus", "Eddie", "Troy", "Mike", "Dustin", "Ray", "Adrian", "Bernard", "Leroy", "Angel", "Randall", "Wesley", "Ian", "Jared", "Mason", "Hunter", "Calvin", "Oscar", "Clifford", "Jay", "Shane", "Ronnie", "Barry", "Lucas", "Corey", "Manuel", "Leo", "Tommy", "Warren", "Jackson", "Isaiah", "Connor", "Don", "Dean", "Jon", "Julian", "Miguel", "Bill", "Lloyd", "Charlie", "Mitchell", "Leon", "Jerome", "Darrell", "Jeremiah", "Alvin", "Brett", "Seth", "Floyd", "Jim", "Blake", "Micheal", "Gordon", "Trevor", "Lewis", "Erik", "Edgar", "Vernon", "Devin", "Gavin", "Jayden", "Chris", "Clyde", "Tom", "Derrick", "Mario", "Brent", "Marc", "Herman", "Chase", "Dominic", "Ricardo", "Franklin", "Maurice", "Max", "Aiden", "Owen", "Lester", "Gilbert", "Elmer", "Gene", "Francisco", "Glen", "Cory", "Garrett", "Clayton", "Sam", "Jorge", "Chester", "Alejandro", "Jeff", "Harvey", "Milton", "Cole", "Ivan", "Andre", "Duane", "Landon"],
            "female": ["Mary", "Emma", "Elizabeth", "Minnie", "Margaret", "Ida", "Alice", "Bertha", "Sarah", "Annie", "Clara", "Ella", "Florence", "Cora", "Martha", "Laura", "Nellie", "Grace", "Carrie", "Maude", "Mabel", "Bessie", "Jennie", "Gertrude", "Julia", "Hattie", "Edith", "Mattie", "Rose", "Catherine", "Lillian", "Ada", "Lillie", "Helen", "Jessie", "Louise", "Ethel", "Lula", "Myrtle", "Eva", "Frances", "Lena", "Lucy", "Edna", "Maggie", "Pearl", "Daisy", "Fannie", "Josephine", "Dora", "Rosa", "Katherine", "Agnes", "Marie", "Nora", "May", "Mamie", "Blanche", "Stella", "Ellen", "Nancy", "Effie", "Sallie", "Nettie", "Della", "Lizzie", "Flora", "Susie", "Maud", "Mae", "Etta", "Harriet", "Sadie", "Caroline", "Katie", "Lydia", "Elsie", "Kate", "Susan", "Mollie", "Alma", "Addie", "Georgia", "Eliza", "Lulu", "Nannie", "Lottie", "Amanda", "Belle", "Charlotte", "Rebecca", "Ruth", "Viola", "Olive", "Amelia", "Hannah", "Jane", "Virginia", "Emily", "Matilda", "Irene", "Kathryn", "Esther", "Willie", "Henrietta", "Ollie", "Amy", "Rachel", "Sara", "Estella", "Theresa", "Augusta", "Ora", "Pauline", "Josie", "Lola", "Sophia", "Leona", "Anne", "Mildred", "Ann", "Beulah", "Callie", "Lou", "Delia", "Eleanor", "Barbara", "Iva", "Louisa", "Maria", "Mayme", "Evelyn", "Estelle", "Nina", "Betty", "Marion", "Bettie", "Dorothy", "Luella", "Inez", "Lela", "Rosie", "Allie", "Millie", "Janie", "Cornelia", "Victoria", "Ruby", "Winifred", "Alta", "Celia", "Christine", "Beatrice", "Birdie", "Harriett", "Mable", "Myra", "Sophie", "Tillie", "Isabel", "Sylvia", "Carolyn", "Isabelle", "Leila", "Sally", "Ina", "Essie", "Bertie", "Nell", "Alberta", "Katharine", "Lora", "Rena", "Mina", "Rhoda", "Mathilda", "Abbie", "Eula", "Dollie", "Hettie", "Eunice", "Fanny", "Ola", "Lenora", "Adelaide", "Christina", "Lelia", "Nelle", "Sue", "Johanna", "Lilly", "Lucinda", "Minerva", "Lettie", "Roxie", "Cynthia", "Helena", "Hilda", "Hulda", "Bernice", "Genevieve", "Jean", "Cordelia", "Marian", "Francis", "Jeanette", "Adeline", "Gussie", "Leah", "Lois", "Lura", "Mittie", "Hallie", "Isabella", "Olga", "Phoebe", "Teresa", "Hester", "Lida", "Lina", "Winnie", "Claudia", "Marguerite", "Vera", "Cecelia", "Bess", "Emilie", "John", "Rosetta", "Verna", "Myrtie", "Cecilia", "Elva", "Olivia", "Ophelia", "Georgie", "Elnora", "Violet", "Adele", "Lily", "Linnie", "Loretta", "Madge", "Polly", "Virgie", "Eugenia", "Lucile", "Lucille", "Mabelle", "Rosalie"]
        },

        lastNames: ['Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee', 'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King', 'Wright', 'Lopez', 'Hill', 'Scott', 'Green', 'Adams', 'Baker', 'Gonzalez', 'Nelson', 'Carter', 'Mitchell', 'Perez', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Sanchez', 'Morris', 'Rogers', 'Reed', 'Cook', 'Morgan', 'Bell', 'Murphy', 'Bailey', 'Rivera', 'Cooper', 'Richardson', 'Cox', 'Howard', 'Ward', 'Torres', 'Peterson', 'Gray', 'Ramirez', 'James', 'Watson', 'Brooks', 'Kelly', 'Sanders', 'Price', 'Bennett', 'Wood', 'Barnes', 'Ross', 'Henderson', 'Coleman', 'Jenkins', 'Perry', 'Powell', 'Long', 'Patterson', 'Hughes', 'Flores', 'Washington', 'Butler', 'Simmons', 'Foster', 'Gonzales', 'Bryant', 'Alexander', 'Russell', 'Griffin', 'Diaz', 'Hayes', 'Myers', 'Ford', 'Hamilton', 'Graham', 'Sullivan', 'Wallace', 'Woods', 'Cole', 'West', 'Jordan', 'Owens', 'Reynolds', 'Fisher', 'Ellis', 'Harrison', 'Gibson', 'McDonald', 'Cruz', 'Marshall', 'Ortiz', 'Gomez', 'Murray', 'Freeman', 'Wells', 'Webb', 'Simpson', 'Stevens', 'Tucker', 'Porter', 'Hunter', 'Hicks', 'Crawford', 'Henry', 'Boyd', 'Mason', 'Morales', 'Kennedy', 'Warren', 'Dixon', 'Ramos', 'Reyes', 'Burns', 'Gordon', 'Shaw', 'Holmes', 'Rice', 'Robertson', 'Hunt', 'Black', 'Daniels', 'Palmer', 'Mills', 'Nichols', 'Grant', 'Knight', 'Ferguson', 'Rose', 'Stone', 'Hawkins', 'Dunn', 'Perkins', 'Hudson', 'Spencer', 'Gardner', 'Stephens', 'Payne', 'Pierce', 'Berry', 'Matthews', 'Arnold', 'Wagner', 'Willis', 'Ray', 'Watkins', 'Olson', 'Carroll', 'Duncan', 'Snyder', 'Hart', 'Cunningham', 'Bradley', 'Lane', 'Andrews', 'Ruiz', 'Harper', 'Fox', 'Riley', 'Armstrong', 'Carpenter', 'Weaver', 'Greene', 'Lawrence', 'Elliott', 'Chavez', 'Sims', 'Austin', 'Peters', 'Kelley', 'Franklin', 'Lawson', 'Fields', 'Gutierrez', 'Ryan', 'Schmidt', 'Carr', 'Vasquez', 'Castillo', 'Wheeler', 'Chapman', 'Oliver', 'Montgomery', 'Richards', 'Williamson', 'Johnston', 'Banks', 'Meyer', 'Bishop', 'McCoy', 'Howell', 'Alvarez', 'Morrison', 'Hansen', 'Fernandez', 'Garza', 'Harvey', 'Little', 'Burton', 'Stanley', 'Nguyen', 'George', 'Jacobs', 'Reid', 'Kim', 'Fuller', 'Lynch', 'Dean', 'Gilbert', 'Garrett', 'Romero', 'Welch', 'Larson', 'Frazier', 'Burke', 'Hanson', 'Day', 'Mendoza', 'Moreno', 'Bowman', 'Medina', 'Fowler', 'Brewer', 'Hoffman', 'Carlson', 'Silva', 'Pearson', 'Holland', 'Douglas', 'Fleming', 'Jensen', 'Vargas', 'Byrd', 'Davidson', 'Hopkins', 'May', 'Terry', 'Herrera', 'Wade', 'Soto', 'Walters', 'Curtis', 'Neal', 'Caldwell', 'Lowe', 'Jennings', 'Barnett', 'Graves', 'Jimenez', 'Horton', 'Shelton', 'Barrett', 'Obrien', 'Castro', 'Sutton', 'Gregory', 'McKinney', 'Lucas', 'Miles', 'Craig', 'Rodriquez', 'Chambers', 'Holt', 'Lambert', 'Fletcher', 'Watts', 'Bates', 'Hale', 'Rhodes', 'Pena', 'Beck', 'Newman', 'Haynes', 'McDaniel', 'Mendez', 'Bush', 'Vaughn', 'Parks', 'Dawson', 'Santiago', 'Norris', 'Hardy', 'Love', 'Steele', 'Curry', 'Powers', 'Schultz', 'Barker', 'Guzman', 'Page', 'Munoz', 'Ball', 'Keller', 'Chandler', 'Weber', 'Leonard', 'Walsh', 'Lyons', 'Ramsey', 'Wolfe', 'Schneider', 'Mullins', 'Benson', 'Sharp', 'Bowen', 'Daniel', 'Barber', 'Cummings', 'Hines', 'Baldwin', 'Griffith', 'Valdez', 'Hubbard', 'Salazar', 'Reeves', 'Warner', 'Stevenson', 'Burgess', 'Santos', 'Tate', 'Cross', 'Garner', 'Mann', 'Mack', 'Moss', 'Thornton', 'Dennis', 'McGee', 'Farmer', 'Delgado', 'Aguilar', 'Vega', 'Glover', 'Manning', 'Cohen', 'Harmon', 'Rodgers', 'Robbins', 'Newton', 'Todd', 'Blair', 'Higgins', 'Ingram', 'Reese', 'Cannon', 'Strickland', 'Townsend', 'Potter', 'Goodwin', 'Walton', 'Rowe', 'Hampton', 'Ortega', 'Patton', 'Swanson', 'Joseph', 'Francis', 'Goodman', 'Maldonado', 'Yates', 'Becker', 'Erickson', 'Hodges', 'Rios', 'Conner', 'Adkins', 'Webster', 'Norman', 'Malone', 'Hammond', 'Flowers', 'Cobb', 'Moody', 'Quinn', 'Blake', 'Maxwell', 'Pope', 'Floyd', 'Osborne', 'Paul', 'McCarthy', 'Guerrero', 'Lindsey', 'Estrada', 'Sandoval', 'Gibbs', 'Tyler', 'Gross', 'Fitzgerald', 'Stokes', 'Doyle', 'Sherman', 'Saunders', 'Wise', 'Colon', 'Gill', 'Alvarado', 'Greer', 'Padilla', 'Simon', 'Waters', 'Nunez', 'Ballard', 'Schwartz', 'McBride', 'Houston', 'Christensen', 'Klein', 'Pratt', 'Briggs', 'Parsons', 'McLaughlin', 'Zimmerman', 'French', 'Buchanan', 'Moran', 'Copeland', 'Roy', 'Pittman', 'Brady', 'McCormick', 'Holloway', 'Brock', 'Poole', 'Frank', 'Logan', 'Owen', 'Bass', 'Marsh', 'Drake', 'Wong', 'Jefferson', 'Park', 'Morton', 'Abbott', 'Sparks', 'Patrick', 'Norton', 'Huff', 'Clayton', 'Massey', 'Lloyd', 'Figueroa', 'Carson', 'Bowers', 'Roberson', 'Barton', 'Tran', 'Lamb', 'Harrington', 'Casey', 'Boone', 'Cortez', 'Clarke', 'Mathis', 'Singleton', 'Wilkins', 'Cain', 'Bryan', 'Underwood', 'Hogan', 'McKenzie', 'Collier', 'Luna', 'Phelps', 'McGuire', 'Allison', 'Bridges', 'Wilkerson', 'Nash', 'Summers', 'Atkins'],

        // Data taken from https://github.com/umpirsky/country-list/blob/master/country/cldr/en_US/country.json
        countries: [{"name":"Afghanistan","abbreviation":"AF"},{"name":"Albania","abbreviation":"AL"},{"name":"Algeria","abbreviation":"DZ"},{"name":"American Samoa","abbreviation":"AS"},{"name":"Andorra","abbreviation":"AD"},{"name":"Angola","abbreviation":"AO"},{"name":"Anguilla","abbreviation":"AI"},{"name":"Antarctica","abbreviation":"AQ"},{"name":"Antigua and Barbuda","abbreviation":"AG"},{"name":"Argentina","abbreviation":"AR"},{"name":"Armenia","abbreviation":"AM"},{"name":"Aruba","abbreviation":"AW"},{"name":"Australia","abbreviation":"AU"},{"name":"Austria","abbreviation":"AT"},{"name":"Azerbaijan","abbreviation":"AZ"},{"name":"Bahamas","abbreviation":"BS"},{"name":"Bahrain","abbreviation":"BH"},{"name":"Bangladesh","abbreviation":"BD"},{"name":"Barbados","abbreviation":"BB"},{"name":"Belarus","abbreviation":"BY"},{"name":"Belgium","abbreviation":"BE"},{"name":"Belize","abbreviation":"BZ"},{"name":"Benin","abbreviation":"BJ"},{"name":"Bermuda","abbreviation":"BM"},{"name":"Bhutan","abbreviation":"BT"},{"name":"Bolivia","abbreviation":"BO"},{"name":"Bosnia and Herzegovina","abbreviation":"BA"},{"name":"Botswana","abbreviation":"BW"},{"name":"Bouvet Island","abbreviation":"BV"},{"name":"Brazil","abbreviation":"BR"},{"name":"British Antarctic Territory","abbreviation":"BQ"},{"name":"British Indian Ocean Territory","abbreviation":"IO"},{"name":"British Virgin Islands","abbreviation":"VG"},{"name":"Brunei","abbreviation":"BN"},{"name":"Bulgaria","abbreviation":"BG"},{"name":"Burkina Faso","abbreviation":"BF"},{"name":"Burundi","abbreviation":"BI"},{"name":"Cambodia","abbreviation":"KH"},{"name":"Cameroon","abbreviation":"CM"},{"name":"Canada","abbreviation":"CA"},{"name":"Canton and Enderbury Islands","abbreviation":"CT"},{"name":"Cape Verde","abbreviation":"CV"},{"name":"Cayman Islands","abbreviation":"KY"},{"name":"Central African Republic","abbreviation":"CF"},{"name":"Chad","abbreviation":"TD"},{"name":"Chile","abbreviation":"CL"},{"name":"China","abbreviation":"CN"},{"name":"Christmas Island","abbreviation":"CX"},{"name":"Cocos [Keeling] Islands","abbreviation":"CC"},{"name":"Colombia","abbreviation":"CO"},{"name":"Comoros","abbreviation":"KM"},{"name":"Congo - Brazzaville","abbreviation":"CG"},{"name":"Congo - Kinshasa","abbreviation":"CD"},{"name":"Cook Islands","abbreviation":"CK"},{"name":"Costa Rica","abbreviation":"CR"},{"name":"Croatia","abbreviation":"HR"},{"name":"Cuba","abbreviation":"CU"},{"name":"Cyprus","abbreviation":"CY"},{"name":"Czech Republic","abbreviation":"CZ"},{"name":"Côte d’Ivoire","abbreviation":"CI"},{"name":"Denmark","abbreviation":"DK"},{"name":"Djibouti","abbreviation":"DJ"},{"name":"Dominica","abbreviation":"DM"},{"name":"Dominican Republic","abbreviation":"DO"},{"name":"Dronning Maud Land","abbreviation":"NQ"},{"name":"East Germany","abbreviation":"DD"},{"name":"Ecuador","abbreviation":"EC"},{"name":"Egypt","abbreviation":"EG"},{"name":"El Salvador","abbreviation":"SV"},{"name":"Equatorial Guinea","abbreviation":"GQ"},{"name":"Eritrea","abbreviation":"ER"},{"name":"Estonia","abbreviation":"EE"},{"name":"Ethiopia","abbreviation":"ET"},{"name":"Falkland Islands","abbreviation":"FK"},{"name":"Faroe Islands","abbreviation":"FO"},{"name":"Fiji","abbreviation":"FJ"},{"name":"Finland","abbreviation":"FI"},{"name":"France","abbreviation":"FR"},{"name":"French Guiana","abbreviation":"GF"},{"name":"French Polynesia","abbreviation":"PF"},{"name":"French Southern Territories","abbreviation":"TF"},{"name":"French Southern and Antarctic Territories","abbreviation":"FQ"},{"name":"Gabon","abbreviation":"GA"},{"name":"Gambia","abbreviation":"GM"},{"name":"Georgia","abbreviation":"GE"},{"name":"Germany","abbreviation":"DE"},{"name":"Ghana","abbreviation":"GH"},{"name":"Gibraltar","abbreviation":"GI"},{"name":"Greece","abbreviation":"GR"},{"name":"Greenland","abbreviation":"GL"},{"name":"Grenada","abbreviation":"GD"},{"name":"Guadeloupe","abbreviation":"GP"},{"name":"Guam","abbreviation":"GU"},{"name":"Guatemala","abbreviation":"GT"},{"name":"Guernsey","abbreviation":"GG"},{"name":"Guinea","abbreviation":"GN"},{"name":"Guinea-Bissau","abbreviation":"GW"},{"name":"Guyana","abbreviation":"GY"},{"name":"Haiti","abbreviation":"HT"},{"name":"Heard Island and McDonald Islands","abbreviation":"HM"},{"name":"Honduras","abbreviation":"HN"},{"name":"Hong Kong SAR China","abbreviation":"HK"},{"name":"Hungary","abbreviation":"HU"},{"name":"Iceland","abbreviation":"IS"},{"name":"India","abbreviation":"IN"},{"name":"Indonesia","abbreviation":"ID"},{"name":"Iran","abbreviation":"IR"},{"name":"Iraq","abbreviation":"IQ"},{"name":"Ireland","abbreviation":"IE"},{"name":"Isle of Man","abbreviation":"IM"},{"name":"Israel","abbreviation":"IL"},{"name":"Italy","abbreviation":"IT"},{"name":"Jamaica","abbreviation":"JM"},{"name":"Japan","abbreviation":"JP"},{"name":"Jersey","abbreviation":"JE"},{"name":"Johnston Island","abbreviation":"JT"},{"name":"Jordan","abbreviation":"JO"},{"name":"Kazakhstan","abbreviation":"KZ"},{"name":"Kenya","abbreviation":"KE"},{"name":"Kiribati","abbreviation":"KI"},{"name":"Kuwait","abbreviation":"KW"},{"name":"Kyrgyzstan","abbreviation":"KG"},{"name":"Laos","abbreviation":"LA"},{"name":"Latvia","abbreviation":"LV"},{"name":"Lebanon","abbreviation":"LB"},{"name":"Lesotho","abbreviation":"LS"},{"name":"Liberia","abbreviation":"LR"},{"name":"Libya","abbreviation":"LY"},{"name":"Liechtenstein","abbreviation":"LI"},{"name":"Lithuania","abbreviation":"LT"},{"name":"Luxembourg","abbreviation":"LU"},{"name":"Macau SAR China","abbreviation":"MO"},{"name":"Macedonia","abbreviation":"MK"},{"name":"Madagascar","abbreviation":"MG"},{"name":"Malawi","abbreviation":"MW"},{"name":"Malaysia","abbreviation":"MY"},{"name":"Maldives","abbreviation":"MV"},{"name":"Mali","abbreviation":"ML"},{"name":"Malta","abbreviation":"MT"},{"name":"Marshall Islands","abbreviation":"MH"},{"name":"Martinique","abbreviation":"MQ"},{"name":"Mauritania","abbreviation":"MR"},{"name":"Mauritius","abbreviation":"MU"},{"name":"Mayotte","abbreviation":"YT"},{"name":"Metropolitan France","abbreviation":"FX"},{"name":"Mexico","abbreviation":"MX"},{"name":"Micronesia","abbreviation":"FM"},{"name":"Midway Islands","abbreviation":"MI"},{"name":"Moldova","abbreviation":"MD"},{"name":"Monaco","abbreviation":"MC"},{"name":"Mongolia","abbreviation":"MN"},{"name":"Montenegro","abbreviation":"ME"},{"name":"Montserrat","abbreviation":"MS"},{"name":"Morocco","abbreviation":"MA"},{"name":"Mozambique","abbreviation":"MZ"},{"name":"Myanmar [Burma]","abbreviation":"MM"},{"name":"Namibia","abbreviation":"NA"},{"name":"Nauru","abbreviation":"NR"},{"name":"Nepal","abbreviation":"NP"},{"name":"Netherlands","abbreviation":"NL"},{"name":"Netherlands Antilles","abbreviation":"AN"},{"name":"Neutral Zone","abbreviation":"NT"},{"name":"New Caledonia","abbreviation":"NC"},{"name":"New Zealand","abbreviation":"NZ"},{"name":"Nicaragua","abbreviation":"NI"},{"name":"Niger","abbreviation":"NE"},{"name":"Nigeria","abbreviation":"NG"},{"name":"Niue","abbreviation":"NU"},{"name":"Norfolk Island","abbreviation":"NF"},{"name":"North Korea","abbreviation":"KP"},{"name":"North Vietnam","abbreviation":"VD"},{"name":"Northern Mariana Islands","abbreviation":"MP"},{"name":"Norway","abbreviation":"NO"},{"name":"Oman","abbreviation":"OM"},{"name":"Pacific Islands Trust Territory","abbreviation":"PC"},{"name":"Pakistan","abbreviation":"PK"},{"name":"Palau","abbreviation":"PW"},{"name":"Palestinian Territories","abbreviation":"PS"},{"name":"Panama","abbreviation":"PA"},{"name":"Panama Canal Zone","abbreviation":"PZ"},{"name":"Papua New Guinea","abbreviation":"PG"},{"name":"Paraguay","abbreviation":"PY"},{"name":"People's Democratic Republic of Yemen","abbreviation":"YD"},{"name":"Peru","abbreviation":"PE"},{"name":"Philippines","abbreviation":"PH"},{"name":"Pitcairn Islands","abbreviation":"PN"},{"name":"Poland","abbreviation":"PL"},{"name":"Portugal","abbreviation":"PT"},{"name":"Puerto Rico","abbreviation":"PR"},{"name":"Qatar","abbreviation":"QA"},{"name":"Romania","abbreviation":"RO"},{"name":"Russia","abbreviation":"RU"},{"name":"Rwanda","abbreviation":"RW"},{"name":"Réunion","abbreviation":"RE"},{"name":"Saint Barthélemy","abbreviation":"BL"},{"name":"Saint Helena","abbreviation":"SH"},{"name":"Saint Kitts and Nevis","abbreviation":"KN"},{"name":"Saint Lucia","abbreviation":"LC"},{"name":"Saint Martin","abbreviation":"MF"},{"name":"Saint Pierre and Miquelon","abbreviation":"PM"},{"name":"Saint Vincent and the Grenadines","abbreviation":"VC"},{"name":"Samoa","abbreviation":"WS"},{"name":"San Marino","abbreviation":"SM"},{"name":"Saudi Arabia","abbreviation":"SA"},{"name":"Senegal","abbreviation":"SN"},{"name":"Serbia","abbreviation":"RS"},{"name":"Serbia and Montenegro","abbreviation":"CS"},{"name":"Seychelles","abbreviation":"SC"},{"name":"Sierra Leone","abbreviation":"SL"},{"name":"Singapore","abbreviation":"SG"},{"name":"Slovakia","abbreviation":"SK"},{"name":"Slovenia","abbreviation":"SI"},{"name":"Solomon Islands","abbreviation":"SB"},{"name":"Somalia","abbreviation":"SO"},{"name":"South Africa","abbreviation":"ZA"},{"name":"South Georgia and the South Sandwich Islands","abbreviation":"GS"},{"name":"South Korea","abbreviation":"KR"},{"name":"Spain","abbreviation":"ES"},{"name":"Sri Lanka","abbreviation":"LK"},{"name":"Sudan","abbreviation":"SD"},{"name":"Suriname","abbreviation":"SR"},{"name":"Svalbard and Jan Mayen","abbreviation":"SJ"},{"name":"Swaziland","abbreviation":"SZ"},{"name":"Sweden","abbreviation":"SE"},{"name":"Switzerland","abbreviation":"CH"},{"name":"Syria","abbreviation":"SY"},{"name":"São Tomé and Príncipe","abbreviation":"ST"},{"name":"Taiwan","abbreviation":"TW"},{"name":"Tajikistan","abbreviation":"TJ"},{"name":"Tanzania","abbreviation":"TZ"},{"name":"Thailand","abbreviation":"TH"},{"name":"Timor-Leste","abbreviation":"TL"},{"name":"Togo","abbreviation":"TG"},{"name":"Tokelau","abbreviation":"TK"},{"name":"Tonga","abbreviation":"TO"},{"name":"Trinidad and Tobago","abbreviation":"TT"},{"name":"Tunisia","abbreviation":"TN"},{"name":"Turkey","abbreviation":"TR"},{"name":"Turkmenistan","abbreviation":"TM"},{"name":"Turks and Caicos Islands","abbreviation":"TC"},{"name":"Tuvalu","abbreviation":"TV"},{"name":"U.S. Minor Outlying Islands","abbreviation":"UM"},{"name":"U.S. Miscellaneous Pacific Islands","abbreviation":"PU"},{"name":"U.S. Virgin Islands","abbreviation":"VI"},{"name":"Uganda","abbreviation":"UG"},{"name":"Ukraine","abbreviation":"UA"},{"name":"Union of Soviet Socialist Republics","abbreviation":"SU"},{"name":"United Arab Emirates","abbreviation":"AE"},{"name":"United Kingdom","abbreviation":"GB"},{"name":"United States","abbreviation":"US"},{"name":"Unknown or Invalid Region","abbreviation":"ZZ"},{"name":"Uruguay","abbreviation":"UY"},{"name":"Uzbekistan","abbreviation":"UZ"},{"name":"Vanuatu","abbreviation":"VU"},{"name":"Vatican City","abbreviation":"VA"},{"name":"Venezuela","abbreviation":"VE"},{"name":"Vietnam","abbreviation":"VN"},{"name":"Wake Island","abbreviation":"WK"},{"name":"Wallis and Futuna","abbreviation":"WF"},{"name":"Western Sahara","abbreviation":"EH"},{"name":"Yemen","abbreviation":"YE"},{"name":"Zambia","abbreviation":"ZM"},{"name":"Zimbabwe","abbreviation":"ZW"},{"name":"Åland Islands","abbreviation":"AX"}],

        provinces: [
            {name: 'Alberta', abbreviation: 'AB'},
            {name: 'British Columbia', abbreviation: 'BC'},
            {name: 'Manitoba', abbreviation: 'MB'},
            {name: 'New Brunswick', abbreviation: 'NB'},
            {name: 'Newfoundland and Labrador', abbreviation: 'NL'},
            {name: 'Nova Scotia', abbreviation: 'NS'},
            {name: 'Ontario', abbreviation: 'ON'},
            {name: 'Prince Edward Island', abbreviation: 'PE'},
            {name: 'Quebec', abbreviation: 'QC'},
            {name: 'Saskatchewan', abbreviation: 'SK'},

            // The case could be made that the following are not actually provinces
            // since they are technically considered "territories" however they all
            // look the same on an envelope!
            {name: 'Northwest Territories', abbreviation: 'NT'},
            {name: 'Nunavut', abbreviation: 'NU'},
            {name: 'Yukon', abbreviation: 'YT'}
        ],

        us_states_and_dc: [
            {name: 'Alabama', abbreviation: 'AL'},
            {name: 'Alaska', abbreviation: 'AK'},
            {name: 'Arizona', abbreviation: 'AZ'},
            {name: 'Arkansas', abbreviation: 'AR'},
            {name: 'California', abbreviation: 'CA'},
            {name: 'Colorado', abbreviation: 'CO'},
            {name: 'Connecticut', abbreviation: 'CT'},
            {name: 'Delaware', abbreviation: 'DE'},
            {name: 'District of Columbia', abbreviation: 'DC'},
            {name: 'Florida', abbreviation: 'FL'},
            {name: 'Georgia', abbreviation: 'GA'},
            {name: 'Hawaii', abbreviation: 'HI'},
            {name: 'Idaho', abbreviation: 'ID'},
            {name: 'Illinois', abbreviation: 'IL'},
            {name: 'Indiana', abbreviation: 'IN'},
            {name: 'Iowa', abbreviation: 'IA'},
            {name: 'Kansas', abbreviation: 'KS'},
            {name: 'Kentucky', abbreviation: 'KY'},
            {name: 'Louisiana', abbreviation: 'LA'},
            {name: 'Maine', abbreviation: 'ME'},
            {name: 'Maryland', abbreviation: 'MD'},
            {name: 'Massachusetts', abbreviation: 'MA'},
            {name: 'Michigan', abbreviation: 'MI'},
            {name: 'Minnesota', abbreviation: 'MN'},
            {name: 'Mississippi', abbreviation: 'MS'},
            {name: 'Missouri', abbreviation: 'MO'},
            {name: 'Montana', abbreviation: 'MT'},
            {name: 'Nebraska', abbreviation: 'NE'},
            {name: 'Nevada', abbreviation: 'NV'},
            {name: 'New Hampshire', abbreviation: 'NH'},
            {name: 'New Jersey', abbreviation: 'NJ'},
            {name: 'New Mexico', abbreviation: 'NM'},
            {name: 'New York', abbreviation: 'NY'},
            {name: 'North Carolina', abbreviation: 'NC'},
            {name: 'North Dakota', abbreviation: 'ND'},
            {name: 'Ohio', abbreviation: 'OH'},
            {name: 'Oklahoma', abbreviation: 'OK'},
            {name: 'Oregon', abbreviation: 'OR'},
            {name: 'Pennsylvania', abbreviation: 'PA'},
            {name: 'Rhode Island', abbreviation: 'RI'},
            {name: 'South Carolina', abbreviation: 'SC'},
            {name: 'South Dakota', abbreviation: 'SD'},
            {name: 'Tennessee', abbreviation: 'TN'},
            {name: 'Texas', abbreviation: 'TX'},
            {name: 'Utah', abbreviation: 'UT'},
            {name: 'Vermont', abbreviation: 'VT'},
            {name: 'Virginia', abbreviation: 'VA'},
            {name: 'Washington', abbreviation: 'WA'},
            {name: 'West Virginia', abbreviation: 'WV'},
            {name: 'Wisconsin', abbreviation: 'WI'},
            {name: 'Wyoming', abbreviation: 'WY'}
        ],

        territories: [
            {name: 'American Samoa', abbreviation: 'AS'},
            {name: 'Federated States of Micronesia', abbreviation: 'FM'},
            {name: 'Guam', abbreviation: 'GU'},
            {name: 'Marshall Islands', abbreviation: 'MH'},
            {name: 'Northern Mariana Islands', abbreviation: 'MP'},
            {name: 'Puerto Rico', abbreviation: 'PR'},
            {name: 'Virgin Islands, U.S.', abbreviation: 'VI'}
        ],

        armed_forces: [
            {name: 'Armed Forces Europe', abbreviation: 'AE'},
            {name: 'Armed Forces Pacific', abbreviation: 'AP'},
            {name: 'Armed Forces the Americas', abbreviation: 'AA'}
        ],

        street_suffixes: [
            {name: 'Avenue', abbreviation: 'Ave'},
            {name: 'Boulevard', abbreviation: 'Blvd'},
            {name: 'Center', abbreviation: 'Ctr'},
            {name: 'Circle', abbreviation: 'Cir'},
            {name: 'Court', abbreviation: 'Ct'},
            {name: 'Drive', abbreviation: 'Dr'},
            {name: 'Extension', abbreviation: 'Ext'},
            {name: 'Glen', abbreviation: 'Gln'},
            {name: 'Grove', abbreviation: 'Grv'},
            {name: 'Heights', abbreviation: 'Hts'},
            {name: 'Highway', abbreviation: 'Hwy'},
            {name: 'Junction', abbreviation: 'Jct'},
            {name: 'Key', abbreviation: 'Key'},
            {name: 'Lane', abbreviation: 'Ln'},
            {name: 'Loop', abbreviation: 'Loop'},
            {name: 'Manor', abbreviation: 'Mnr'},
            {name: 'Mill', abbreviation: 'Mill'},
            {name: 'Park', abbreviation: 'Park'},
            {name: 'Parkway', abbreviation: 'Pkwy'},
            {name: 'Pass', abbreviation: 'Pass'},
            {name: 'Path', abbreviation: 'Path'},
            {name: 'Pike', abbreviation: 'Pike'},
            {name: 'Place', abbreviation: 'Pl'},
            {name: 'Plaza', abbreviation: 'Plz'},
            {name: 'Point', abbreviation: 'Pt'},
            {name: 'Ridge', abbreviation: 'Rdg'},
            {name: 'River', abbreviation: 'Riv'},
            {name: 'Road', abbreviation: 'Rd'},
            {name: 'Square', abbreviation: 'Sq'},
            {name: 'Street', abbreviation: 'St'},
            {name: 'Terrace', abbreviation: 'Ter'},
            {name: 'Trail', abbreviation: 'Trl'},
            {name: 'Turnpike', abbreviation: 'Tpke'},
            {name: 'View', abbreviation: 'Vw'},
            {name: 'Way', abbreviation: 'Way'}
        ],

        months: [
            {name: 'January', short_name: 'Jan', numeric: '01', days: 31},
            // Not messing with leap years...
            {name: 'February', short_name: 'Feb', numeric: '02', days: 28},
            {name: 'March', short_name: 'Mar', numeric: '03', days: 31},
            {name: 'April', short_name: 'Apr', numeric: '04', days: 30},
            {name: 'May', short_name: 'May', numeric: '05', days: 31},
            {name: 'June', short_name: 'Jun', numeric: '06', days: 30},
            {name: 'July', short_name: 'Jul', numeric: '07', days: 31},
            {name: 'August', short_name: 'Aug', numeric: '08', days: 31},
            {name: 'September', short_name: 'Sep', numeric: '09', days: 30},
            {name: 'October', short_name: 'Oct', numeric: '10', days: 31},
            {name: 'November', short_name: 'Nov', numeric: '11', days: 30},
            {name: 'December', short_name: 'Dec', numeric: '12', days: 31}
        ],

        // http://en.wikipedia.org/wiki/Bank_card_number#Issuer_identification_number_.28IIN.29
        cc_types: [
            {name: "American Express", short_name: 'amex', prefix: '34', length: 15},
            {name: "Bankcard", short_name: 'bankcard', prefix: '5610', length: 16},
            {name: "China UnionPay", short_name: 'chinaunion', prefix: '62', length: 16},
            {name: "Diners Club Carte Blanche", short_name: 'dccarte', prefix: '300', length: 14},
            {name: "Diners Club enRoute", short_name: 'dcenroute', prefix: '2014', length: 15},
            {name: "Diners Club International", short_name: 'dcintl', prefix: '36', length: 14},
            {name: "Diners Club United States & Canada", short_name: 'dcusc', prefix: '54', length: 16},
            {name: "Discover Card", short_name: 'discover', prefix: '6011', length: 16},
            {name: "InstaPayment", short_name: 'instapay', prefix: '637', length: 16},
            {name: "JCB", short_name: 'jcb', prefix: '3528', length: 16},
            {name: "Laser", short_name: 'laser', prefix: '6304', length: 16},
            {name: "Maestro", short_name: 'maestro', prefix: '5018', length: 16},
            {name: "Mastercard", short_name: 'mc', prefix: '51', length: 16},
            {name: "Solo", short_name: 'solo', prefix: '6334', length: 16},
            {name: "Switch", short_name: 'switch', prefix: '4903', length: 16},
            {name: "Visa", short_name: 'visa', prefix: '4', length: 16},
            {name: "Visa Electron", short_name: 'electron', prefix: '4026', length: 16}
        ],

        //return all world currency by ISO 4217
        currency_types: [
            {'code' : 'AED', 'name' : 'United Arab Emirates Dirham'},
            {'code' : 'AFN', 'name' : 'Afghanistan Afghani'},
            {'code' : 'ALL', 'name' : 'Albania Lek'},
            {'code' : 'AMD', 'name' : 'Armenia Dram'},
            {'code' : 'ANG', 'name' : 'Netherlands Antilles Guilder'},
            {'code' : 'AOA', 'name' : 'Angola Kwanza'},
            {'code' : 'ARS', 'name' : 'Argentina Peso'},
            {'code' : 'AUD', 'name' : 'Australia Dollar'},
            {'code' : 'AWG', 'name' : 'Aruba Guilder'},
            {'code' : 'AZN', 'name' : 'Azerbaijan New Manat'},
            {'code' : 'BAM', 'name' : 'Bosnia and Herzegovina Convertible Marka'},
            {'code' : 'BBD', 'name' : 'Barbados Dollar'},
            {'code' : 'BDT', 'name' : 'Bangladesh Taka'},
            {'code' : 'BGN', 'name' : 'Bulgaria Lev'},
            {'code' : 'BHD', 'name' : 'Bahrain Dinar'},
            {'code' : 'BIF', 'name' : 'Burundi Franc'},
            {'code' : 'BMD', 'name' : 'Bermuda Dollar'},
            {'code' : 'BND', 'name' : 'Brunei Darussalam Dollar'},
            {'code' : 'BOB', 'name' : 'Bolivia Boliviano'},
            {'code' : 'BRL', 'name' : 'Brazil Real'},
            {'code' : 'BSD', 'name' : 'Bahamas Dollar'},
            {'code' : 'BTN', 'name' : 'Bhutan Ngultrum'},
            {'code' : 'BWP', 'name' : 'Botswana Pula'},
            {'code' : 'BYR', 'name' : 'Belarus Ruble'},
            {'code' : 'BZD', 'name' : 'Belize Dollar'},
            {'code' : 'CAD', 'name' : 'Canada Dollar'},
            {'code' : 'CDF', 'name' : 'Congo/Kinshasa Franc'},
            {'code' : 'CHF', 'name' : 'Switzerland Franc'},
            {'code' : 'CLP', 'name' : 'Chile Peso'},
            {'code' : 'CNY', 'name' : 'China Yuan Renminbi'},
            {'code' : 'COP', 'name' : 'Colombia Peso'},
            {'code' : 'CRC', 'name' : 'Costa Rica Colon'},
            {'code' : 'CUC', 'name' : 'Cuba Convertible Peso'},
            {'code' : 'CUP', 'name' : 'Cuba Peso'},
            {'code' : 'CVE', 'name' : 'Cape Verde Escudo'},
            {'code' : 'CZK', 'name' : 'Czech Republic Koruna'},
            {'code' : 'DJF', 'name' : 'Djibouti Franc'},
            {'code' : 'DKK', 'name' : 'Denmark Krone'},
            {'code' : 'DOP', 'name' : 'Dominican Republic Peso'},
            {'code' : 'DZD', 'name' : 'Algeria Dinar'},
            {'code' : 'EGP', 'name' : 'Egypt Pound'},
            {'code' : 'ERN', 'name' : 'Eritrea Nakfa'},
            {'code' : 'ETB', 'name' : 'Ethiopia Birr'},
            {'code' : 'EUR', 'name' : 'Euro Member Countries'},
            {'code' : 'FJD', 'name' : 'Fiji Dollar'},
            {'code' : 'FKP', 'name' : 'Falkland Islands (Malvinas) Pound'},
            {'code' : 'GBP', 'name' : 'United Kingdom Pound'},
            {'code' : 'GEL', 'name' : 'Georgia Lari'},
            {'code' : 'GGP', 'name' : 'Guernsey Pound'},
            {'code' : 'GHS', 'name' : 'Ghana Cedi'},
            {'code' : 'GIP', 'name' : 'Gibraltar Pound'},
            {'code' : 'GMD', 'name' : 'Gambia Dalasi'},
            {'code' : 'GNF', 'name' : 'Guinea Franc'},
            {'code' : 'GTQ', 'name' : 'Guatemala Quetzal'},
            {'code' : 'GYD', 'name' : 'Guyana Dollar'},
            {'code' : 'HKD', 'name' : 'Hong Kong Dollar'},
            {'code' : 'HNL', 'name' : 'Honduras Lempira'},
            {'code' : 'HRK', 'name' : 'Croatia Kuna'},
            {'code' : 'HTG', 'name' : 'Haiti Gourde'},
            {'code' : 'HUF', 'name' : 'Hungary Forint'},
            {'code' : 'IDR', 'name' : 'Indonesia Rupiah'},
            {'code' : 'ILS', 'name' : 'Israel Shekel'},
            {'code' : 'IMP', 'name' : 'Isle of Man Pound'},
            {'code' : 'INR', 'name' : 'India Rupee'},
            {'code' : 'IQD', 'name' : 'Iraq Dinar'},
            {'code' : 'IRR', 'name' : 'Iran Rial'},
            {'code' : 'ISK', 'name' : 'Iceland Krona'},
            {'code' : 'JEP', 'name' : 'Jersey Pound'},
            {'code' : 'JMD', 'name' : 'Jamaica Dollar'},
            {'code' : 'JOD', 'name' : 'Jordan Dinar'},
            {'code' : 'JPY', 'name' : 'Japan Yen'},
            {'code' : 'KES', 'name' : 'Kenya Shilling'},
            {'code' : 'KGS', 'name' : 'Kyrgyzstan Som'},
            {'code' : 'KHR', 'name' : 'Cambodia Riel'},
            {'code' : 'KMF', 'name' : 'Comoros Franc'},
            {'code' : 'KPW', 'name' : 'Korea (North) Won'},
            {'code' : 'KRW', 'name' : 'Korea (South) Won'},
            {'code' : 'KWD', 'name' : 'Kuwait Dinar'},
            {'code' : 'KYD', 'name' : 'Cayman Islands Dollar'},
            {'code' : 'KZT', 'name' : 'Kazakhstan Tenge'},
            {'code' : 'LAK', 'name' : 'Laos Kip'},
            {'code' : 'LBP', 'name' : 'Lebanon Pound'},
            {'code' : 'LKR', 'name' : 'Sri Lanka Rupee'},
            {'code' : 'LRD', 'name' : 'Liberia Dollar'},
            {'code' : 'LSL', 'name' : 'Lesotho Loti'},
            {'code' : 'LTL', 'name' : 'Lithuania Litas'},
            {'code' : 'LYD', 'name' : 'Libya Dinar'},
            {'code' : 'MAD', 'name' : 'Morocco Dirham'},
            {'code' : 'MDL', 'name' : 'Moldova Leu'},
            {'code' : 'MGA', 'name' : 'Madagascar Ariary'},
            {'code' : 'MKD', 'name' : 'Macedonia Denar'},
            {'code' : 'MMK', 'name' : 'Myanmar (Burma) Kyat'},
            {'code' : 'MNT', 'name' : 'Mongolia Tughrik'},
            {'code' : 'MOP', 'name' : 'Macau Pataca'},
            {'code' : 'MRO', 'name' : 'Mauritania Ouguiya'},
            {'code' : 'MUR', 'name' : 'Mauritius Rupee'},
            {'code' : 'MVR', 'name' : 'Maldives (Maldive Islands) Rufiyaa'},
            {'code' : 'MWK', 'name' : 'Malawi Kwacha'},
            {'code' : 'MXN', 'name' : 'Mexico Peso'},
            {'code' : 'MYR', 'name' : 'Malaysia Ringgit'},
            {'code' : 'MZN', 'name' : 'Mozambique Metical'},
            {'code' : 'NAD', 'name' : 'Namibia Dollar'},
            {'code' : 'NGN', 'name' : 'Nigeria Naira'},
            {'code' : 'NIO', 'name' : 'Nicaragua Cordoba'},
            {'code' : 'NOK', 'name' : 'Norway Krone'},
            {'code' : 'NPR', 'name' : 'Nepal Rupee'},
            {'code' : 'NZD', 'name' : 'New Zealand Dollar'},
            {'code' : 'OMR', 'name' : 'Oman Rial'},
            {'code' : 'PAB', 'name' : 'Panama Balboa'},
            {'code' : 'PEN', 'name' : 'Peru Nuevo Sol'},
            {'code' : 'PGK', 'name' : 'Papua New Guinea Kina'},
            {'code' : 'PHP', 'name' : 'Philippines Peso'},
            {'code' : 'PKR', 'name' : 'Pakistan Rupee'},
            {'code' : 'PLN', 'name' : 'Poland Zloty'},
            {'code' : 'PYG', 'name' : 'Paraguay Guarani'},
            {'code' : 'QAR', 'name' : 'Qatar Riyal'},
            {'code' : 'RON', 'name' : 'Romania New Leu'},
            {'code' : 'RSD', 'name' : 'Serbia Dinar'},
            {'code' : 'RUB', 'name' : 'Russia Ruble'},
            {'code' : 'RWF', 'name' : 'Rwanda Franc'},
            {'code' : 'SAR', 'name' : 'Saudi Arabia Riyal'},
            {'code' : 'SBD', 'name' : 'Solomon Islands Dollar'},
            {'code' : 'SCR', 'name' : 'Seychelles Rupee'},
            {'code' : 'SDG', 'name' : 'Sudan Pound'},
            {'code' : 'SEK', 'name' : 'Sweden Krona'},
            {'code' : 'SGD', 'name' : 'Singapore Dollar'},
            {'code' : 'SHP', 'name' : 'Saint Helena Pound'},
            {'code' : 'SLL', 'name' : 'Sierra Leone Leone'},
            {'code' : 'SOS', 'name' : 'Somalia Shilling'},
            {'code' : 'SPL', 'name' : 'Seborga Luigino'},
            {'code' : 'SRD', 'name' : 'Suriname Dollar'},
            {'code' : 'STD', 'name' : 'São Tomé and Príncipe Dobra'},
            {'code' : 'SVC', 'name' : 'El Salvador Colon'},
            {'code' : 'SYP', 'name' : 'Syria Pound'},
            {'code' : 'SZL', 'name' : 'Swaziland Lilangeni'},
            {'code' : 'THB', 'name' : 'Thailand Baht'},
            {'code' : 'TJS', 'name' : 'Tajikistan Somoni'},
            {'code' : 'TMT', 'name' : 'Turkmenistan Manat'},
            {'code' : 'TND', 'name' : 'Tunisia Dinar'},
            {'code' : 'TOP', 'name' : 'Tonga Pa\'anga'},
            {'code' : 'TRY', 'name' : 'Turkey Lira'},
            {'code' : 'TTD', 'name' : 'Trinidad and Tobago Dollar'},
            {'code' : 'TVD', 'name' : 'Tuvalu Dollar'},
            {'code' : 'TWD', 'name' : 'Taiwan New Dollar'},
            {'code' : 'TZS', 'name' : 'Tanzania Shilling'},
            {'code' : 'UAH', 'name' : 'Ukraine Hryvnia'},
            {'code' : 'UGX', 'name' : 'Uganda Shilling'},
            {'code' : 'USD', 'name' : 'United States Dollar'},
            {'code' : 'UYU', 'name' : 'Uruguay Peso'},
            {'code' : 'UZS', 'name' : 'Uzbekistan Som'},
            {'code' : 'VEF', 'name' : 'Venezuela Bolivar'},
            {'code' : 'VND', 'name' : 'Viet Nam Dong'},
            {'code' : 'VUV', 'name' : 'Vanuatu Vatu'},
            {'code' : 'WST', 'name' : 'Samoa Tala'},
            {'code' : 'XAF', 'name' : 'Communauté Financière Africaine (BEAC) CFA Franc BEAC'},
            {'code' : 'XCD', 'name' : 'East Caribbean Dollar'},
            {'code' : 'XDR', 'name' : 'International Monetary Fund (IMF) Special Drawing Rights'},
            {'code' : 'XOF', 'name' : 'Communauté Financière Africaine (BCEAO) Franc'},
            {'code' : 'XPF', 'name' : 'Comptoirs Français du Pacifique (CFP) Franc'},
            {'code' : 'YER', 'name' : 'Yemen Rial'},
            {'code' : 'ZAR', 'name' : 'South Africa Rand'},
            {'code' : 'ZMW', 'name' : 'Zambia Kwacha'},
            {'code' : 'ZWD', 'name' : 'Zimbabwe Dollar'}
        ]
    };

    var o_hasOwnProperty = Object.prototype.hasOwnProperty;
    var o_keys = (Object.keys || function(obj) {
      var result = [];
      for (var key in obj) {
        if (o_hasOwnProperty.call(obj, key)) {
          result.push(key);
        }
      }

      return result;
    });

    function _copyObject(source, target) {
      var keys = o_keys(source);
      var key;

      for (var i = 0, l = keys.length; i < l; i++) {
        key = keys[i];
        target[key] = source[key] || target[key];
      }
    }

    function _copyArray(source, target) {
      for (var i = 0, l = source.length; i < l; i++) {
        target[i] = source[i];
      }
    }

    function copyObject(source, _target) {
        var isArray = Array.isArray(source);
        var target = _target || (isArray ? new Array(source.length) : {});

        if (isArray) {
          _copyArray(source, target);
        } else {
          _copyObject(source, target);
        }

        return target;
    }

    /** Get the data based on key**/
    Chance.prototype.get = function (name) {
        return copyObject(data[name]);
    };

    // Mac Address
    Chance.prototype.mac_address = function(options){
        // typically mac addresses are separated by ":"
        // however they can also be separated by "-"
        // the network variant uses a dot every fourth byte

        options = initOptions(options);
        if(!options.separator) {
            options.separator =  options.networkVersion ? "." : ":";
        }

        var mac_pool="ABCDEF1234567890",
            mac = "";
        if(!options.networkVersion) {
            mac = this.n(this.string, 6, { pool: mac_pool, length:2 }).join(options.separator);
        } else {
            mac = this.n(this.string, 3, { pool: mac_pool, length:4 }).join(options.separator);
        }

        return mac;
    };

    Chance.prototype.normal = function (options) {
        options = initOptions(options, {mean : 0, dev : 1});

        // The Marsaglia Polar method
        var s, u, v, norm,
            mean = options.mean,
            dev = options.dev;

        do {
            // U and V are from the uniform distribution on (-1, 1)
            u = this.random() * 2 - 1;
            v = this.random() * 2 - 1;

            s = u * u + v * v;
        } while (s >= 1);

        // Compute the standard normal variate
        norm = u * Math.sqrt(-2 * Math.log(s) / s);

        // Shape and scale
        return dev * norm + mean;
    };

    Chance.prototype.radio = function (options) {
        // Initial Letter (Typically Designated by Side of Mississippi River)
        options = initOptions(options, {side : "?"});
        var fl = "";
        switch (options.side.toLowerCase()) {
        case "east":
        case "e":
            fl = "W";
            break;
        case "west":
        case "w":
            fl = "K";
            break;
        default:
            fl = this.character({pool: "KW"});
            break;
        }

        return fl + this.character({alpha: true, casing: "upper"}) +
                this.character({alpha: true, casing: "upper"}) +
                this.character({alpha: true, casing: "upper"});
    };

    // Set the data as key and data or the data map
    Chance.prototype.set = function (name, values) {
        if (typeof name === "string") {
            data[name] = values;
        } else {
            data = copyObject(name, data);
        }
    };

    Chance.prototype.tv = function (options) {
        return this.radio(options);
    };

    // ID number for Brazil companies
    Chance.prototype.cnpj = function () {
        var n = this.n(this.natural, 8, { max: 9 });
        var d1 = 2+n[7]*6+n[6]*7+n[5]*8+n[4]*9+n[3]*2+n[2]*3+n[1]*4+n[0]*5;
        d1 = 11 - (d1 % 11);
        if (d1>=10){
            d1 = 0;
        }
        var d2 = d1*2+3+n[7]*7+n[6]*8+n[5]*9+n[4]*2+n[3]*3+n[2]*4+n[1]*5+n[0]*6;
        d2 = 11 - (d2 % 11);
        if (d2>=10){
            d2 = 0;
        }
        return ''+n[0]+n[1]+'.'+n[2]+n[3]+n[4]+'.'+n[5]+n[6]+n[7]+'/0001-'+d1+d2;
    };

    // -- End Miscellaneous --

    Chance.prototype.mersenne_twister = function (seed) {
        return new MersenneTwister(seed);
    };

    Chance.prototype.blueimp_md5 = function () {
        return new BlueImpMD5();
    };

    // Mersenne Twister from https://gist.github.com/banksean/300494
    var MersenneTwister = function (seed) {
        if (seed === undefined) {
            // kept random number same size as time used previously to ensure no unexpected results downstream
            seed = Math.floor(Math.random()*Math.pow(10,13));
        }
        /* Period parameters */
        this.N = 624;
        this.M = 397;
        this.MATRIX_A = 0x9908b0df;   /* constant vector a */
        this.UPPER_MASK = 0x80000000; /* most significant w-r bits */
        this.LOWER_MASK = 0x7fffffff; /* least significant r bits */

        this.mt = new Array(this.N); /* the array for the state vector */
        this.mti = this.N + 1; /* mti==N + 1 means mt[N] is not initialized */

        this.init_genrand(seed);
    };

    /* initializes mt[N] with a seed */
    MersenneTwister.prototype.init_genrand = function (s) {
        this.mt[0] = s >>> 0;
        for (this.mti = 1; this.mti < this.N; this.mti++) {
            s = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
            this.mt[this.mti] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) + (s & 0x0000ffff) * 1812433253) + this.mti;
            /* See Knuth TAOCP Vol2. 3rd Ed. P.106 for multiplier. */
            /* In the previous versions, MSBs of the seed affect   */
            /* only MSBs of the array mt[].                        */
            /* 2002/01/09 modified by Makoto Matsumoto             */
            this.mt[this.mti] >>>= 0;
            /* for >32 bit machines */
        }
    };

    /* initialize by an array with array-length */
    /* init_key is the array for initializing keys */
    /* key_length is its length */
    /* slight change for C++, 2004/2/26 */
    MersenneTwister.prototype.init_by_array = function (init_key, key_length) {
        var i = 1, j = 0, k, s;
        this.init_genrand(19650218);
        k = (this.N > key_length ? this.N : key_length);
        for (; k; k--) {
            s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
            this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1664525) << 16) + ((s & 0x0000ffff) * 1664525))) + init_key[j] + j; /* non linear */
            this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
            i++;
            j++;
            if (i >= this.N) { this.mt[0] = this.mt[this.N - 1]; i = 1; }
            if (j >= key_length) { j = 0; }
        }
        for (k = this.N - 1; k; k--) {
            s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
            this.mt[i] = (this.mt[i] ^ (((((s & 0xffff0000) >>> 16) * 1566083941) << 16) + (s & 0x0000ffff) * 1566083941)) - i; /* non linear */
            this.mt[i] >>>= 0; /* for WORDSIZE > 32 machines */
            i++;
            if (i >= this.N) { this.mt[0] = this.mt[this.N - 1]; i = 1; }
        }

        this.mt[0] = 0x80000000; /* MSB is 1; assuring non-zero initial array */
    };

    /* generates a random number on [0,0xffffffff]-interval */
    MersenneTwister.prototype.genrand_int32 = function () {
        var y;
        var mag01 = new Array(0x0, this.MATRIX_A);
        /* mag01[x] = x * MATRIX_A  for x=0,1 */

        if (this.mti >= this.N) { /* generate N words at one time */
            var kk;

            if (this.mti === this.N + 1) {   /* if init_genrand() has not been called, */
                this.init_genrand(5489); /* a default initial seed is used */
            }
            for (kk = 0; kk < this.N - this.M; kk++) {
                y = (this.mt[kk]&this.UPPER_MASK)|(this.mt[kk + 1]&this.LOWER_MASK);
                this.mt[kk] = this.mt[kk + this.M] ^ (y >>> 1) ^ mag01[y & 0x1];
            }
            for (;kk < this.N - 1; kk++) {
                y = (this.mt[kk]&this.UPPER_MASK)|(this.mt[kk + 1]&this.LOWER_MASK);
                this.mt[kk] = this.mt[kk + (this.M - this.N)] ^ (y >>> 1) ^ mag01[y & 0x1];
            }
            y = (this.mt[this.N - 1]&this.UPPER_MASK)|(this.mt[0]&this.LOWER_MASK);
            this.mt[this.N - 1] = this.mt[this.M - 1] ^ (y >>> 1) ^ mag01[y & 0x1];

            this.mti = 0;
        }

        y = this.mt[this.mti++];

        /* Tempering */
        y ^= (y >>> 11);
        y ^= (y << 7) & 0x9d2c5680;
        y ^= (y << 15) & 0xefc60000;
        y ^= (y >>> 18);

        return y >>> 0;
    };

    /* generates a random number on [0,0x7fffffff]-interval */
    MersenneTwister.prototype.genrand_int31 = function () {
        return (this.genrand_int32() >>> 1);
    };

    /* generates a random number on [0,1]-real-interval */
    MersenneTwister.prototype.genrand_real1 = function () {
        return this.genrand_int32() * (1.0 / 4294967295.0);
        /* divided by 2^32-1 */
    };

    /* generates a random number on [0,1)-real-interval */
    MersenneTwister.prototype.random = function () {
        return this.genrand_int32() * (1.0 / 4294967296.0);
        /* divided by 2^32 */
    };

    /* generates a random number on (0,1)-real-interval */
    MersenneTwister.prototype.genrand_real3 = function () {
        return (this.genrand_int32() + 0.5) * (1.0 / 4294967296.0);
        /* divided by 2^32 */
    };

    /* generates a random number on [0,1) with 53-bit resolution*/
    MersenneTwister.prototype.genrand_res53 = function () {
        var a = this.genrand_int32()>>>5, b = this.genrand_int32()>>>6;
        return (a * 67108864.0 + b) * (1.0 / 9007199254740992.0);
    };

    // BlueImp MD5 hashing algorithm from https://github.com/blueimp/JavaScript-MD5
    var BlueImpMD5 = function () {};

    BlueImpMD5.prototype.VERSION = '1.0.1';

    /*
    * Add integers, wrapping at 2^32. This uses 16-bit operations internally
    * to work around bugs in some JS interpreters.
    */
    BlueImpMD5.prototype.safe_add = function safe_add(x, y) {
        var lsw = (x & 0xFFFF) + (y & 0xFFFF),
            msw = (x >> 16) + (y >> 16) + (lsw >> 16);
        return (msw << 16) | (lsw & 0xFFFF);
    };

    /*
    * Bitwise rotate a 32-bit number to the left.
    */
    BlueImpMD5.prototype.bit_roll = function (num, cnt) {
        return (num << cnt) | (num >>> (32 - cnt));
    };

    /*
    * These functions implement the five basic operations the algorithm uses.
    */
    BlueImpMD5.prototype.md5_cmn = function (q, a, b, x, s, t) {
        return this.safe_add(this.bit_roll(this.safe_add(this.safe_add(a, q), this.safe_add(x, t)), s), b);
    };
    BlueImpMD5.prototype.md5_ff = function (a, b, c, d, x, s, t) {
        return this.md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
    };
    BlueImpMD5.prototype.md5_gg = function (a, b, c, d, x, s, t) {
        return this.md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
    };
    BlueImpMD5.prototype.md5_hh = function (a, b, c, d, x, s, t) {
        return this.md5_cmn(b ^ c ^ d, a, b, x, s, t);
    };
    BlueImpMD5.prototype.md5_ii = function (a, b, c, d, x, s, t) {
        return this.md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
    };

    /*
    * Calculate the MD5 of an array of little-endian words, and a bit length.
    */
    BlueImpMD5.prototype.binl_md5 = function (x, len) {
        /* append padding */
        x[len >> 5] |= 0x80 << (len % 32);
        x[(((len + 64) >>> 9) << 4) + 14] = len;

        var i, olda, oldb, oldc, oldd,
            a =  1732584193,
            b = -271733879,
            c = -1732584194,
            d =  271733878;

        for (i = 0; i < x.length; i += 16) {
            olda = a;
            oldb = b;
            oldc = c;
            oldd = d;

            a = this.md5_ff(a, b, c, d, x[i],       7, -680876936);
            d = this.md5_ff(d, a, b, c, x[i +  1], 12, -389564586);
            c = this.md5_ff(c, d, a, b, x[i +  2], 17,  606105819);
            b = this.md5_ff(b, c, d, a, x[i +  3], 22, -1044525330);
            a = this.md5_ff(a, b, c, d, x[i +  4],  7, -176418897);
            d = this.md5_ff(d, a, b, c, x[i +  5], 12,  1200080426);
            c = this.md5_ff(c, d, a, b, x[i +  6], 17, -1473231341);
            b = this.md5_ff(b, c, d, a, x[i +  7], 22, -45705983);
            a = this.md5_ff(a, b, c, d, x[i +  8],  7,  1770035416);
            d = this.md5_ff(d, a, b, c, x[i +  9], 12, -1958414417);
            c = this.md5_ff(c, d, a, b, x[i + 10], 17, -42063);
            b = this.md5_ff(b, c, d, a, x[i + 11], 22, -1990404162);
            a = this.md5_ff(a, b, c, d, x[i + 12],  7,  1804603682);
            d = this.md5_ff(d, a, b, c, x[i + 13], 12, -40341101);
            c = this.md5_ff(c, d, a, b, x[i + 14], 17, -1502002290);
            b = this.md5_ff(b, c, d, a, x[i + 15], 22,  1236535329);

            a = this.md5_gg(a, b, c, d, x[i +  1],  5, -165796510);
            d = this.md5_gg(d, a, b, c, x[i +  6],  9, -1069501632);
            c = this.md5_gg(c, d, a, b, x[i + 11], 14,  643717713);
            b = this.md5_gg(b, c, d, a, x[i],      20, -373897302);
            a = this.md5_gg(a, b, c, d, x[i +  5],  5, -701558691);
            d = this.md5_gg(d, a, b, c, x[i + 10],  9,  38016083);
            c = this.md5_gg(c, d, a, b, x[i + 15], 14, -660478335);
            b = this.md5_gg(b, c, d, a, x[i +  4], 20, -405537848);
            a = this.md5_gg(a, b, c, d, x[i +  9],  5,  568446438);
            d = this.md5_gg(d, a, b, c, x[i + 14],  9, -1019803690);
            c = this.md5_gg(c, d, a, b, x[i +  3], 14, -187363961);
            b = this.md5_gg(b, c, d, a, x[i +  8], 20,  1163531501);
            a = this.md5_gg(a, b, c, d, x[i + 13],  5, -1444681467);
            d = this.md5_gg(d, a, b, c, x[i +  2],  9, -51403784);
            c = this.md5_gg(c, d, a, b, x[i +  7], 14,  1735328473);
            b = this.md5_gg(b, c, d, a, x[i + 12], 20, -1926607734);

            a = this.md5_hh(a, b, c, d, x[i +  5],  4, -378558);
            d = this.md5_hh(d, a, b, c, x[i +  8], 11, -2022574463);
            c = this.md5_hh(c, d, a, b, x[i + 11], 16,  1839030562);
            b = this.md5_hh(b, c, d, a, x[i + 14], 23, -35309556);
            a = this.md5_hh(a, b, c, d, x[i +  1],  4, -1530992060);
            d = this.md5_hh(d, a, b, c, x[i +  4], 11,  1272893353);
            c = this.md5_hh(c, d, a, b, x[i +  7], 16, -155497632);
            b = this.md5_hh(b, c, d, a, x[i + 10], 23, -1094730640);
            a = this.md5_hh(a, b, c, d, x[i + 13],  4,  681279174);
            d = this.md5_hh(d, a, b, c, x[i],      11, -358537222);
            c = this.md5_hh(c, d, a, b, x[i +  3], 16, -722521979);
            b = this.md5_hh(b, c, d, a, x[i +  6], 23,  76029189);
            a = this.md5_hh(a, b, c, d, x[i +  9],  4, -640364487);
            d = this.md5_hh(d, a, b, c, x[i + 12], 11, -421815835);
            c = this.md5_hh(c, d, a, b, x[i + 15], 16,  530742520);
            b = this.md5_hh(b, c, d, a, x[i +  2], 23, -995338651);

            a = this.md5_ii(a, b, c, d, x[i],       6, -198630844);
            d = this.md5_ii(d, a, b, c, x[i +  7], 10,  1126891415);
            c = this.md5_ii(c, d, a, b, x[i + 14], 15, -1416354905);
            b = this.md5_ii(b, c, d, a, x[i +  5], 21, -57434055);
            a = this.md5_ii(a, b, c, d, x[i + 12],  6,  1700485571);
            d = this.md5_ii(d, a, b, c, x[i +  3], 10, -1894986606);
            c = this.md5_ii(c, d, a, b, x[i + 10], 15, -1051523);
            b = this.md5_ii(b, c, d, a, x[i +  1], 21, -2054922799);
            a = this.md5_ii(a, b, c, d, x[i +  8],  6,  1873313359);
            d = this.md5_ii(d, a, b, c, x[i + 15], 10, -30611744);
            c = this.md5_ii(c, d, a, b, x[i +  6], 15, -1560198380);
            b = this.md5_ii(b, c, d, a, x[i + 13], 21,  1309151649);
            a = this.md5_ii(a, b, c, d, x[i +  4],  6, -145523070);
            d = this.md5_ii(d, a, b, c, x[i + 11], 10, -1120210379);
            c = this.md5_ii(c, d, a, b, x[i +  2], 15,  718787259);
            b = this.md5_ii(b, c, d, a, x[i +  9], 21, -343485551);

            a = this.safe_add(a, olda);
            b = this.safe_add(b, oldb);
            c = this.safe_add(c, oldc);
            d = this.safe_add(d, oldd);
        }
        return [a, b, c, d];
    };

    /*
    * Convert an array of little-endian words to a string
    */
    BlueImpMD5.prototype.binl2rstr = function (input) {
        var i,
            output = '';
        for (i = 0; i < input.length * 32; i += 8) {
            output += String.fromCharCode((input[i >> 5] >>> (i % 32)) & 0xFF);
        }
        return output;
    };

    /*
    * Convert a raw string to an array of little-endian words
    * Characters >255 have their high-byte silently ignored.
    */
    BlueImpMD5.prototype.rstr2binl = function (input) {
        var i,
            output = [];
        output[(input.length >> 2) - 1] = undefined;
        for (i = 0; i < output.length; i += 1) {
            output[i] = 0;
        }
        for (i = 0; i < input.length * 8; i += 8) {
            output[i >> 5] |= (input.charCodeAt(i / 8) & 0xFF) << (i % 32);
        }
        return output;
    };

    /*
    * Calculate the MD5 of a raw string
    */
    BlueImpMD5.prototype.rstr_md5 = function (s) {
        return this.binl2rstr(this.binl_md5(this.rstr2binl(s), s.length * 8));
    };

    /*
    * Calculate the HMAC-MD5, of a key and some data (raw strings)
    */
    BlueImpMD5.prototype.rstr_hmac_md5 = function (key, data) {
        var i,
            bkey = this.rstr2binl(key),
            ipad = [],
            opad = [],
            hash;
        ipad[15] = opad[15] = undefined;
        if (bkey.length > 16) {
            bkey = this.binl_md5(bkey, key.length * 8);
        }
        for (i = 0; i < 16; i += 1) {
            ipad[i] = bkey[i] ^ 0x36363636;
            opad[i] = bkey[i] ^ 0x5C5C5C5C;
        }
        hash = this.binl_md5(ipad.concat(this.rstr2binl(data)), 512 + data.length * 8);
        return this.binl2rstr(this.binl_md5(opad.concat(hash), 512 + 128));
    };

    /*
    * Convert a raw string to a hex string
    */
    BlueImpMD5.prototype.rstr2hex = function (input) {
        var hex_tab = '0123456789abcdef',
            output = '',
            x,
            i;
        for (i = 0; i < input.length; i += 1) {
            x = input.charCodeAt(i);
            output += hex_tab.charAt((x >>> 4) & 0x0F) +
                hex_tab.charAt(x & 0x0F);
        }
        return output;
    };

    /*
    * Encode a string as utf-8
    */
    BlueImpMD5.prototype.str2rstr_utf8 = function (input) {
        return unescape(encodeURIComponent(input));
    };

    /*
    * Take string arguments and return either raw or hex encoded strings
    */
    BlueImpMD5.prototype.raw_md5 = function (s) {
        return this.rstr_md5(this.str2rstr_utf8(s));
    };
    BlueImpMD5.prototype.hex_md5 = function (s) {
        return this.rstr2hex(this.raw_md5(s));
    };
    BlueImpMD5.prototype.raw_hmac_md5 = function (k, d) {
        return this.rstr_hmac_md5(this.str2rstr_utf8(k), this.str2rstr_utf8(d));
    };
    BlueImpMD5.prototype.hex_hmac_md5 = function (k, d) {
        return this.rstr2hex(this.raw_hmac_md5(k, d));
    };

    BlueImpMD5.prototype.md5 = function (string, key, raw) {
        if (!key) {
            if (!raw) {
                return this.hex_md5(string);
            }

            return this.raw_md5(string);
        }

        if (!raw) {
            return this.hex_hmac_md5(key, string);
        }

        return this.raw_hmac_md5(key, string);
    };

    // CommonJS module
    if (typeof exports !== 'undefined') {
        if (typeof module !== 'undefined' && module.exports) {
            exports = module.exports = Chance;
        }
        exports.Chance = Chance;
    }

    // Register as an anonymous AMD module
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            return Chance;
        });
    }

    // if there is a importsScrips object define chance for worker
    if (typeof importScripts !== 'undefined') {
        chance = new Chance();
    }

    // If there is a window object, that at least has a document property,
    // instantiate and define chance on the window
    if (typeof window === "object" && typeof window.document === "object") {
        window.Chance = Chance;
        window.chance = new Chance();
    }
})();

}).call(this,require("buffer").Buffer)

},{"buffer":19}],22:[function(require,module,exports){
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
},{"select":33}],23:[function(require,module,exports){
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
},{"./clipboard-action":22,"good-listener":29,"tiny-emitter":34}],24:[function(require,module,exports){
var matches = require('matches-selector')

module.exports = function (element, selector, checkYoSelf) {
  var parent = checkYoSelf ? element : element.parentNode

  while (parent && parent !== document) {
    if (matches(parent, selector)) return parent;
    parent = parent.parentNode
  }
}

},{"matches-selector":31}],25:[function(require,module,exports){
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

},{"closest":24}],26:[function(require,module,exports){
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

},{"eventie":27}],27:[function(require,module,exports){
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

},{}],28:[function(require,module,exports){
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

},{}],29:[function(require,module,exports){
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

},{"./is":28,"delegate":25}],30:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],31:[function(require,module,exports){

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
},{}],32:[function(require,module,exports){
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

},{}],33:[function(require,module,exports){
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

},{}],34:[function(require,module,exports){
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

},{}],35:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createComponent = require('./createComponent');

var _createComponent2 = _interopRequireDefault(_createComponent);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.default = (0, _createComponent2.default)();
},{"./createComponent":51}],36:[function(require,module,exports){
(function (global){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var ua = global.navigator ? global.navigator.userAgent : '';

var isTrident = exports.isTrident = ua.indexOf('Trident') > -1;
var isEdge = exports.isEdge = ua.indexOf('Edge') > -1;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],37:[function(require,module,exports){
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

},{"../utils/console":57,"../utils/dasherize":58,"../utils/escapeAttr":60,"../utils/isInArray":62,"_process":32}],38:[function(require,module,exports){
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
},{}],39:[function(require,module,exports){
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
},{}],40:[function(require,module,exports){
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

},{"../getDomNodeId":42,"./SyntheticEvent":38,"./isEventSupported":41}],41:[function(require,module,exports){
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

},{}],42:[function(require,module,exports){
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
},{}],43:[function(require,module,exports){
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
},{"../utils/emptyObj":59,"./getDomNodeId":42,"./rafBatch":45}],44:[function(require,module,exports){
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

},{"./domAttrs":37,"./events/attrsToEvents":39,"./events/domEventManager":40}],45:[function(require,module,exports){
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

},{}],46:[function(require,module,exports){
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

},{}],47:[function(require,module,exports){
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

},{}],48:[function(require,module,exports){
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
},{"../client/rafBatch":45,"../createComponent":51,"../nodes/TagNode":55}],49:[function(require,module,exports){
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
},{"../client/rafBatch":45,"../createComponent":51,"../nodes/TagNode":55}],50:[function(require,module,exports){
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
},{"../client/rafBatch":45,"../createComponent":51,"../nodes/TagNode":55}],51:[function(require,module,exports){
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

},{"./client/rafBatch":45,"./createNode":52,"./utils/console":57,"./utils/emptyObj":59,"./utils/noOp":63,"_process":32}],52:[function(require,module,exports){
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

},{"./components/Input":48,"./components/Select":49,"./components/Textarea":50,"./nodes/ComponentNode":53,"./nodes/FunctionComponentNode":54,"./nodes/TagNode":55,"./utils/console":57,"_process":32}],53:[function(require,module,exports){
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
},{"../utils/emptyObj":59}],54:[function(require,module,exports){
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

},{"../utils/emptyObj":59,"./TagNode":55,"_process":32}],55:[function(require,module,exports){
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

},{"../client/browsers":36,"../client/domAttrs":37,"../client/events/attrsToEvents":39,"../client/events/domEventManager":40,"../client/patchOps":44,"../client/utils/createElement":46,"../client/utils/createElementByHtml":47,"../utils/console":57,"../utils/emptyObj":59,"../utils/escapeHtml":61,"../utils/isInArray":62,"./ComponentNode":53,"./FunctionComponentNode":54,"_process":32}],56:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (tree) {
  return tree.renderToString();
};
},{}],57:[function(require,module,exports){
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

},{"./noOp":63}],58:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var DASHERIZE_RE = /([^A-Z]+)([A-Z])/g;

exports.default = function (str) {
  return str.replace(DASHERIZE_RE, '$1-$2').toLowerCase();
};
},{}],59:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = {};
},{}],60:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (str) {
    return (str + '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
};
},{}],61:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (str) {
    return (str + '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
};
},{}],62:[function(require,module,exports){
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
},{}],63:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function () {};
},{}],64:[function(require,module,exports){
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
},{"../createNode":52}],65:[function(require,module,exports){
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

},{"./Component":35,"./client/mounter":43,"./createComponent":51,"./createNode":52,"./renderToString":56,"./utils/console":57,"./utils/normalizeChildren":64,"_process":32}],66:[function(require,module,exports){
"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _clipboard = require("clipboard");

var _clipboard2 = _interopRequireDefault(_clipboard);

var _vidom = require("vidom/lib/vidom");

var _docReady = require("doc-ready");

var _docReady2 = _interopRequireDefault(_docReady);

var _tags = require("./tags");

var _tags2 = _interopRequireDefault(_tags);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var CopyButton = function (_Component) {
  _inherits(CopyButton, _Component);

  function CopyButton() {
    _classCallCheck(this, CopyButton);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(CopyButton).apply(this, arguments));
  }

  _createClass(CopyButton, [{
    key: "onRender",
    value: function onRender(_ref) {
      var target = _ref.target;

      var id = "__copy__button__";
      this.clipboard = new _clipboard2.default("#" + id);

      return (0, _vidom.node)("button").attrs({
        "id": id,
        "data-clipboard-target": target
      }).children("Copy");
    }
  }]);

  return CopyButton;
}(_vidom.Component);

var Tag = function (_Component2) {
  _inherits(Tag, _Component2);

  function Tag() {
    _classCallCheck(this, Tag);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Tag).apply(this, arguments));
  }

  _createClass(Tag, [{
    key: "onRender",
    value: function onRender(_ref2) {
      var tag = _ref2.tag;

      return (0, _vidom.node)("span").children("#" + tag + " ");
    }
  }]);

  return Tag;
}(_vidom.Component);

var Tags = function (_Component3) {
  _inherits(Tags, _Component3);

  function Tags() {
    _classCallCheck(this, Tags);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(Tags).apply(this, arguments));
  }

  _createClass(Tags, [{
    key: "onRender",
    value: function onRender(_ref3) {
      var tags = _ref3.tags;
      var id = _ref3.id;

      return (0, _vidom.node)("div").attrs({ id: id }).children(tags.map(function (tag) {
        return (0, _vidom.node)(Tag).attrs({ tag: tag });
      }));
    }
  }]);

  return Tags;
}(_vidom.Component);

var App = function (_Component4) {
  _inherits(App, _Component4);

  function App() {
    _classCallCheck(this, App);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(App).apply(this, arguments));
  }

  _createClass(App, [{
    key: "onRender",
    value: function onRender(_ref4) {
      var tags = _ref4.tags;

      var tagsId = "__tags";
      return (0, _vidom.node)("div").children([(0, _vidom.node)(CopyButton).attrs({ target: "#" + tagsId }), (0, _vidom.node)(Tags).attrs({ tags: tags, id: tagsId })]);
    }
  }]);

  return App;
}(_vidom.Component);

(0, _docReady2.default)(function () {
  var container = document.getElementById('container');
  var ts = (0, _tags2.default)().then(function (tags) {
    (0, _vidom.mountToDom)(container, (0, _vidom.node)(App).attrs({ tags: tags }));
  });
});

},{"./tags":67,"clipboard":23,"doc-ready":26,"vidom/lib/vidom":65}],67:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function () {
  var num = arguments.length <= 0 || arguments[0] === undefined ? 25 : arguments[0];

  return (0, _axios2.default)("./tags.txt").then(function (res) {
    return res.data.split("\n").filter(function (tag) {
      return tag.length > 0;
    });
  }).then(function (tags) {
    return shuffle(tags).splice(0, num);
  }).then(function (tags) {
    return primaryTag.concat(tags);
  });
};

var _axios = require("axios");

var _axios2 = _interopRequireDefault(_axios);

var _chance = require("chance");

var _chance2 = _interopRequireDefault(_chance);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var primaryTag = ["dog", "norfolkterrier"];

function shuffle(tags) {
  var chance = new _chance2.default();
  return chance.shuffle(tags);
}

},{"axios":1,"chance":21}]},{},[66])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2FkYXB0ZXJzL3hoci5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvYXhpb3MuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2NvcmUvSW50ZXJjZXB0b3JNYW5hZ2VyLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9jb3JlL2Rpc3BhdGNoUmVxdWVzdC5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvZGVmYXVsdHMuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvYmluZC5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9idG9hLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2J1aWxkVVJMLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2NvbWJpbmVVUkxzLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL2Nvb2tpZXMuanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvaXNBYnNvbHV0ZVVSTC5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy9pc1VSTFNhbWVPcmlnaW4uanMiLCJub2RlX21vZHVsZXMvYXhpb3MvbGliL2hlbHBlcnMvcGFyc2VIZWFkZXJzLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi9oZWxwZXJzL3NwcmVhZC5qcyIsIm5vZGVfbW9kdWxlcy9heGlvcy9saWIvaGVscGVycy90cmFuc2Zvcm1EYXRhLmpzIiwibm9kZV9tb2R1bGVzL2F4aW9zL2xpYi91dGlscy5qcyIsIm5vZGVfbW9kdWxlcy9iYXNlNjQtanMvbGliL2I2NC5qcyIsIm5vZGVfbW9kdWxlcy9idWZmZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvYnVmZmVyL25vZGVfbW9kdWxlcy9pc2FycmF5L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2NoYW5jZS9jaGFuY2UuanMiLCJub2RlX21vZHVsZXMvY2xpcGJvYXJkL2xpYi9jbGlwYm9hcmQtYWN0aW9uLmpzIiwibm9kZV9tb2R1bGVzL2NsaXBib2FyZC9saWIvY2xpcGJvYXJkLmpzIiwibm9kZV9tb2R1bGVzL2Nsb3Nlc3QvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZGVsZWdhdGUvc3JjL2RlbGVnYXRlLmpzIiwibm9kZV9tb2R1bGVzL2RvYy1yZWFkeS9kb2MtcmVhZHkuanMiLCJub2RlX21vZHVsZXMvZXZlbnRpZS9ldmVudGllLmpzIiwibm9kZV9tb2R1bGVzL2dvb2QtbGlzdGVuZXIvc3JjL2lzLmpzIiwibm9kZV9tb2R1bGVzL2dvb2QtbGlzdGVuZXIvc3JjL2xpc3Rlbi5qcyIsIm5vZGVfbW9kdWxlcy9pZWVlNzU0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL21hdGNoZXMtc2VsZWN0b3IvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcHJvY2Vzcy9icm93c2VyLmpzIiwibm9kZV9tb2R1bGVzL3NlbGVjdC9zcmMvc2VsZWN0LmpzIiwibm9kZV9tb2R1bGVzL3RpbnktZW1pdHRlci9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvQ29tcG9uZW50LmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi9jbGllbnQvYnJvd3NlcnMuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL2NsaWVudC9kb21BdHRycy5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvY2xpZW50L2V2ZW50cy9TeW50aGV0aWNFdmVudC5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvY2xpZW50L2V2ZW50cy9hdHRyc1RvRXZlbnRzLmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi9jbGllbnQvZXZlbnRzL2RvbUV2ZW50TWFuYWdlci5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvY2xpZW50L2V2ZW50cy9pc0V2ZW50U3VwcG9ydGVkLmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi9jbGllbnQvZ2V0RG9tTm9kZUlkLmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi9jbGllbnQvbW91bnRlci5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvY2xpZW50L3BhdGNoT3BzLmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi9jbGllbnQvcmFmQmF0Y2guanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL2NsaWVudC91dGlscy9jcmVhdGVFbGVtZW50LmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi9jbGllbnQvdXRpbHMvY3JlYXRlRWxlbWVudEJ5SHRtbC5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvY29tcG9uZW50cy9JbnB1dC5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvY29tcG9uZW50cy9TZWxlY3QuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL2NvbXBvbmVudHMvVGV4dGFyZWEuanMiLCJub2RlX21vZHVsZXMvdmlkb20vbGliL2NyZWF0ZUNvbXBvbmVudC5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvY3JlYXRlTm9kZS5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvbm9kZXMvQ29tcG9uZW50Tm9kZS5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvbm9kZXMvRnVuY3Rpb25Db21wb25lbnROb2RlLmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi9ub2Rlcy9UYWdOb2RlLmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi9yZW5kZXJUb1N0cmluZy5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvdXRpbHMvY29uc29sZS5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvdXRpbHMvZGFzaGVyaXplLmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi91dGlscy9lbXB0eU9iai5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvdXRpbHMvZXNjYXBlQXR0ci5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvdXRpbHMvZXNjYXBlSHRtbC5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvdXRpbHMvaXNJbkFycmF5LmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi91dGlscy9ub09wLmpzIiwibm9kZV9tb2R1bGVzL3ZpZG9tL2xpYi91dGlscy9ub3JtYWxpemVDaGlsZHJlbi5qcyIsIm5vZGVfbW9kdWxlcy92aWRvbS9saWIvdmlkb20uanMiLCJzcmMvaW5kZXguanMiLCJzcmMvdGFncy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbElBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNwREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3RIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM5NkNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2ppRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdk9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ3pNQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDcENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNwS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDaEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUMzR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7OztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7QUNoUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUN6REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2xxQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQzFHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7SUNqRU07Ozs7Ozs7Ozs7O21DQUNjO1VBQVIscUJBQVE7O0FBQ2hCLFVBQUksS0FBSyxrQkFBTCxDQURZO0FBRWhCLFdBQUssU0FBTCxHQUFpQiw4QkFBa0IsRUFBbEIsQ0FBakIsQ0FGZ0I7O0FBSWhCLGFBQU8saUJBQUssUUFBTCxFQUNKLEtBREksQ0FDRTtBQUNMLGNBQU0sRUFBTjtBQUNBLGlDQUF5QixNQUF6QjtPQUhHLEVBS0osUUFMSSxDQUtLLE1BTEwsQ0FBUCxDQUpnQjs7OztTQURkOzs7SUFjQTs7Ozs7Ozs7Ozs7b0NBQ1c7VUFBTCxnQkFBSzs7QUFDYixhQUFPLGlCQUFLLE1BQUwsRUFBYSxRQUFiLE9BQTBCLFNBQTFCLENBQVAsQ0FEYTs7OztTQURYOzs7SUFLQTs7Ozs7Ozs7Ozs7b0NBQ2tCO1VBQVgsa0JBQVc7VUFBTCxjQUFLOztBQUNwQixhQUFPLGlCQUFLLEtBQUwsRUFDSixLQURJLENBQ0UsRUFBQyxNQUFELEVBREYsRUFFSixRQUZJLENBR0gsS0FBSyxHQUFMLENBQVUsVUFBQyxHQUFELEVBQVM7QUFDakIsZUFBTyxpQkFBSyxHQUFMLEVBQVUsS0FBVixDQUFnQixFQUFDLFFBQUQsRUFBaEIsQ0FBUCxDQURpQjtPQUFULENBSFAsQ0FBUCxDQURvQjs7OztTQURsQjs7O0lBV0E7Ozs7Ozs7Ozs7O29DQUNZO1VBQU4sa0JBQU07O0FBQ2QsVUFBSSxTQUFTLFFBQVQsQ0FEVTtBQUVkLGFBQU8saUJBQUssS0FBTCxFQUNKLFFBREksQ0FDSyxDQUNSLGlCQUFLLFVBQUwsRUFBaUIsS0FBakIsQ0FBdUIsRUFBRSxjQUFZLE1BQVosRUFBekIsQ0FEUSxFQUVSLGlCQUFLLElBQUwsRUFBVyxLQUFYLENBQWlCLEVBQUUsVUFBRixFQUFRLElBQUcsTUFBSCxFQUF6QixDQUZRLENBREwsQ0FBUCxDQUZjOzs7O1NBRFo7OztBQVdOLHdCQUFVLFlBQVU7QUFDbEIsTUFBSSxZQUFZLFNBQVMsY0FBVCxDQUF3QixXQUF4QixDQUFaLENBRGM7QUFFbEIsTUFBSSxLQUFLLHNCQUFPLElBQVAsQ0FBWSxnQkFBUTtBQUMzQiwyQkFBVyxTQUFYLEVBQXNCLGlCQUFLLEdBQUwsRUFBVSxLQUFWLENBQWdCLEVBQUMsTUFBTSxJQUFOLEVBQWpCLENBQXRCLEVBRDJCO0dBQVIsQ0FBakIsQ0FGYztDQUFWLENBQVY7Ozs7Ozs7OztrQkNyQ2UsWUFBa0I7TUFBVCw0REFBTSxrQkFBRzs7QUFDL0IsU0FBTyxxQkFBTSxZQUFOLEVBQW9CLElBQXBCLENBQTBCLGVBQU87QUFDdEMsV0FBTyxJQUFJLElBQUosQ0FBUyxLQUFULENBQWUsSUFBZixFQUFxQixNQUFyQixDQUE0QixVQUFTLEdBQVQsRUFBYTtBQUM5QyxhQUFPLElBQUksTUFBSixHQUFhLENBQWIsQ0FEdUM7S0FBYixDQUFuQyxDQURzQztHQUFQLENBQTFCLENBSUosSUFKSSxDQUlDLGdCQUFRO0FBQ2QsV0FBTyxRQUFRLElBQVIsRUFBYyxNQUFkLENBQXFCLENBQXJCLEVBQXdCLEdBQXhCLENBQVAsQ0FEYztHQUFSLENBSkQsQ0FNSixJQU5JLENBTUMsZ0JBQVE7QUFDZCxXQUFPLFdBQVcsTUFBWCxDQUFrQixJQUFsQixDQUFQLENBRGM7R0FBUixDQU5SLENBRCtCO0NBQWxCOzs7Ozs7Ozs7Ozs7QUFQZixJQUFNLGFBQWEsQ0FBQyxLQUFELEVBQVEsZ0JBQVIsQ0FBYjs7QUFFTixTQUFTLE9BQVQsQ0FBaUIsSUFBakIsRUFBc0I7QUFDcEIsTUFBSSxTQUFTLHNCQUFULENBRGdCO0FBRXBCLFNBQU8sT0FBTyxPQUFQLENBQWUsSUFBZixDQUFQLENBRm9CO0NBQXRCIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvYXhpb3MnKTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcbnZhciBidWlsZFVSTCA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9idWlsZFVSTCcpO1xudmFyIHBhcnNlSGVhZGVycyA9IHJlcXVpcmUoJy4vLi4vaGVscGVycy9wYXJzZUhlYWRlcnMnKTtcbnZhciB0cmFuc2Zvcm1EYXRhID0gcmVxdWlyZSgnLi8uLi9oZWxwZXJzL3RyYW5zZm9ybURhdGEnKTtcbnZhciBpc1VSTFNhbWVPcmlnaW4gPSByZXF1aXJlKCcuLy4uL2hlbHBlcnMvaXNVUkxTYW1lT3JpZ2luJyk7XG52YXIgYnRvYSA9IHdpbmRvdy5idG9hIHx8IHJlcXVpcmUoJy4vLi4vaGVscGVycy9idG9hJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24geGhyQWRhcHRlcihyZXNvbHZlLCByZWplY3QsIGNvbmZpZykge1xuICB2YXIgcmVxdWVzdERhdGEgPSBjb25maWcuZGF0YTtcbiAgdmFyIHJlcXVlc3RIZWFkZXJzID0gY29uZmlnLmhlYWRlcnM7XG5cbiAgaWYgKHV0aWxzLmlzRm9ybURhdGEocmVxdWVzdERhdGEpKSB7XG4gICAgZGVsZXRlIHJlcXVlc3RIZWFkZXJzWydDb250ZW50LVR5cGUnXTsgLy8gTGV0IHRoZSBicm93c2VyIHNldCBpdFxuICB9XG5cbiAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAvLyBGb3IgSUUgOC85IENPUlMgc3VwcG9ydFxuICAvLyBPbmx5IHN1cHBvcnRzIFBPU1QgYW5kIEdFVCBjYWxscyBhbmQgZG9lc24ndCByZXR1cm5zIHRoZSByZXNwb25zZSBoZWFkZXJzLlxuICBpZiAod2luZG93LlhEb21haW5SZXF1ZXN0ICYmICEoJ3dpdGhDcmVkZW50aWFscycgaW4gcmVxdWVzdCkgJiYgIWlzVVJMU2FtZU9yaWdpbihjb25maWcudXJsKSkge1xuICAgIHJlcXVlc3QgPSBuZXcgd2luZG93LlhEb21haW5SZXF1ZXN0KCk7XG4gIH1cblxuICAvLyBIVFRQIGJhc2ljIGF1dGhlbnRpY2F0aW9uXG4gIGlmIChjb25maWcuYXV0aCkge1xuICAgIHZhciB1c2VybmFtZSA9IGNvbmZpZy5hdXRoLnVzZXJuYW1lIHx8ICcnO1xuICAgIHZhciBwYXNzd29yZCA9IGNvbmZpZy5hdXRoLnBhc3N3b3JkIHx8ICcnO1xuICAgIHJlcXVlc3RIZWFkZXJzLkF1dGhvcml6YXRpb24gPSAnQmFzaWMgJyArIGJ0b2EodXNlcm5hbWUgKyAnOicgKyBwYXNzd29yZCk7XG4gIH1cblxuICByZXF1ZXN0Lm9wZW4oY29uZmlnLm1ldGhvZC50b1VwcGVyQ2FzZSgpLCBidWlsZFVSTChjb25maWcudXJsLCBjb25maWcucGFyYW1zLCBjb25maWcucGFyYW1zU2VyaWFsaXplciksIHRydWUpO1xuXG4gIC8vIFNldCB0aGUgcmVxdWVzdCB0aW1lb3V0IGluIE1TXG4gIHJlcXVlc3QudGltZW91dCA9IGNvbmZpZy50aW1lb3V0O1xuXG4gIC8vIExpc3RlbiBmb3IgcmVhZHkgc3RhdGVcbiAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbiBoYW5kbGVMb2FkKCkge1xuICAgIGlmICghcmVxdWVzdCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBQcmVwYXJlIHRoZSByZXNwb25zZVxuICAgIHZhciByZXNwb25zZUhlYWRlcnMgPSAnZ2V0QWxsUmVzcG9uc2VIZWFkZXJzJyBpbiByZXF1ZXN0ID8gcGFyc2VIZWFkZXJzKHJlcXVlc3QuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCkpIDogbnVsbDtcbiAgICB2YXIgcmVzcG9uc2VEYXRhID0gWyd0ZXh0JywgJyddLmluZGV4T2YoY29uZmlnLnJlc3BvbnNlVHlwZSB8fCAnJykgIT09IC0xID8gcmVxdWVzdC5yZXNwb25zZVRleHQgOiByZXF1ZXN0LnJlc3BvbnNlO1xuICAgIHZhciByZXNwb25zZSA9IHtcbiAgICAgIGRhdGE6IHRyYW5zZm9ybURhdGEoXG4gICAgICAgIHJlc3BvbnNlRGF0YSxcbiAgICAgICAgcmVzcG9uc2VIZWFkZXJzLFxuICAgICAgICBjb25maWcudHJhbnNmb3JtUmVzcG9uc2VcbiAgICAgICksXG4gICAgICAvLyBJRSBzZW5kcyAxMjIzIGluc3RlYWQgb2YgMjA0IChodHRwczovL2dpdGh1Yi5jb20vbXphYnJpc2tpZS9heGlvcy9pc3N1ZXMvMjAxKVxuICAgICAgc3RhdHVzOiByZXF1ZXN0LnN0YXR1cyA9PT0gMTIyMyA/IDIwNCA6IHJlcXVlc3Quc3RhdHVzLFxuICAgICAgc3RhdHVzVGV4dDogcmVxdWVzdC5zdGF0dXMgPT09IDEyMjMgPyAnTm8gQ29udGVudCcgOiByZXF1ZXN0LnN0YXR1c1RleHQsXG4gICAgICBoZWFkZXJzOiByZXNwb25zZUhlYWRlcnMsXG4gICAgICBjb25maWc6IGNvbmZpZ1xuICAgIH07XG5cbiAgICAvLyBSZXNvbHZlIG9yIHJlamVjdCB0aGUgUHJvbWlzZSBiYXNlZCBvbiB0aGUgc3RhdHVzXG4gICAgKChyZXNwb25zZS5zdGF0dXMgPj0gMjAwICYmIHJlc3BvbnNlLnN0YXR1cyA8IDMwMCkgfHxcbiAgICAgKCEoJ3N0YXR1cycgaW4gcmVxdWVzdCkgJiYgcmVzcG9uc2UucmVzcG9uc2VUZXh0KSA/XG4gICAgICByZXNvbHZlIDpcbiAgICAgIHJlamVjdCkocmVzcG9uc2UpO1xuXG4gICAgLy8gQ2xlYW4gdXAgcmVxdWVzdFxuICAgIHJlcXVlc3QgPSBudWxsO1xuICB9O1xuXG4gIC8vIEhhbmRsZSBsb3cgbGV2ZWwgbmV0d29yayBlcnJvcnNcbiAgcmVxdWVzdC5vbmVycm9yID0gZnVuY3Rpb24gaGFuZGxlRXJyb3IoKSB7XG4gICAgLy8gUmVhbCBlcnJvcnMgYXJlIGhpZGRlbiBmcm9tIHVzIGJ5IHRoZSBicm93c2VyXG4gICAgLy8gb25lcnJvciBzaG91bGQgb25seSBmaXJlIGlmIGl0J3MgYSBuZXR3b3JrIGVycm9yXG4gICAgcmVqZWN0KG5ldyBFcnJvcignTmV0d29yayBFcnJvcicpKTtcblxuICAgIC8vIENsZWFuIHVwIHJlcXVlc3RcbiAgICByZXF1ZXN0ID0gbnVsbDtcbiAgfTtcblxuICAvLyBBZGQgeHNyZiBoZWFkZXJcbiAgLy8gVGhpcyBpcyBvbmx5IGRvbmUgaWYgcnVubmluZyBpbiBhIHN0YW5kYXJkIGJyb3dzZXIgZW52aXJvbm1lbnQuXG4gIC8vIFNwZWNpZmljYWxseSBub3QgaWYgd2UncmUgaW4gYSB3ZWIgd29ya2VyLCBvciByZWFjdC1uYXRpdmUuXG4gIGlmICh1dGlscy5pc1N0YW5kYXJkQnJvd3NlckVudigpKSB7XG4gICAgdmFyIGNvb2tpZXMgPSByZXF1aXJlKCcuLy4uL2hlbHBlcnMvY29va2llcycpO1xuXG4gICAgLy8gQWRkIHhzcmYgaGVhZGVyXG4gICAgdmFyIHhzcmZWYWx1ZSA9IGNvbmZpZy53aXRoQ3JlZGVudGlhbHMgfHwgaXNVUkxTYW1lT3JpZ2luKGNvbmZpZy51cmwpID9cbiAgICAgICAgY29va2llcy5yZWFkKGNvbmZpZy54c3JmQ29va2llTmFtZSkgOlxuICAgICAgICB1bmRlZmluZWQ7XG5cbiAgICBpZiAoeHNyZlZhbHVlKSB7XG4gICAgICByZXF1ZXN0SGVhZGVyc1tjb25maWcueHNyZkhlYWRlck5hbWVdID0geHNyZlZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIC8vIEFkZCBoZWFkZXJzIHRvIHRoZSByZXF1ZXN0XG4gIGlmICgnc2V0UmVxdWVzdEhlYWRlcicgaW4gcmVxdWVzdCkge1xuICAgIHV0aWxzLmZvckVhY2gocmVxdWVzdEhlYWRlcnMsIGZ1bmN0aW9uIHNldFJlcXVlc3RIZWFkZXIodmFsLCBrZXkpIHtcbiAgICAgIGlmICh0eXBlb2YgcmVxdWVzdERhdGEgPT09ICd1bmRlZmluZWQnICYmIGtleS50b0xvd2VyQ2FzZSgpID09PSAnY29udGVudC10eXBlJykge1xuICAgICAgICAvLyBSZW1vdmUgQ29udGVudC1UeXBlIGlmIGRhdGEgaXMgdW5kZWZpbmVkXG4gICAgICAgIGRlbGV0ZSByZXF1ZXN0SGVhZGVyc1trZXldO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gT3RoZXJ3aXNlIGFkZCBoZWFkZXIgdG8gdGhlIHJlcXVlc3RcbiAgICAgICAgcmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgdmFsKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIC8vIEFkZCB3aXRoQ3JlZGVudGlhbHMgdG8gcmVxdWVzdCBpZiBuZWVkZWRcbiAgaWYgKGNvbmZpZy53aXRoQ3JlZGVudGlhbHMpIHtcbiAgICByZXF1ZXN0LndpdGhDcmVkZW50aWFscyA9IHRydWU7XG4gIH1cblxuICAvLyBBZGQgcmVzcG9uc2VUeXBlIHRvIHJlcXVlc3QgaWYgbmVlZGVkXG4gIGlmIChjb25maWcucmVzcG9uc2VUeXBlKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJlcXVlc3QucmVzcG9uc2VUeXBlID0gY29uZmlnLnJlc3BvbnNlVHlwZTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAocmVxdWVzdC5yZXNwb25zZVR5cGUgIT09ICdqc29uJykge1xuICAgICAgICB0aHJvdyBlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmICh1dGlscy5pc0FycmF5QnVmZmVyKHJlcXVlc3REYXRhKSkge1xuICAgIHJlcXVlc3REYXRhID0gbmV3IERhdGFWaWV3KHJlcXVlc3REYXRhKTtcbiAgfVxuXG4gIC8vIFNlbmQgdGhlIHJlcXVlc3RcbiAgcmVxdWVzdC5zZW5kKHJlcXVlc3REYXRhKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBkZWZhdWx0cyA9IHJlcXVpcmUoJy4vZGVmYXVsdHMnKTtcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcbnZhciBkaXNwYXRjaFJlcXVlc3QgPSByZXF1aXJlKCcuL2NvcmUvZGlzcGF0Y2hSZXF1ZXN0Jyk7XG52YXIgSW50ZXJjZXB0b3JNYW5hZ2VyID0gcmVxdWlyZSgnLi9jb3JlL0ludGVyY2VwdG9yTWFuYWdlcicpO1xudmFyIGlzQWJzb2x1dGVVUkwgPSByZXF1aXJlKCcuL2hlbHBlcnMvaXNBYnNvbHV0ZVVSTCcpO1xudmFyIGNvbWJpbmVVUkxzID0gcmVxdWlyZSgnLi9oZWxwZXJzL2NvbWJpbmVVUkxzJyk7XG52YXIgYmluZCA9IHJlcXVpcmUoJy4vaGVscGVycy9iaW5kJyk7XG52YXIgdHJhbnNmb3JtRGF0YSA9IHJlcXVpcmUoJy4vaGVscGVycy90cmFuc2Zvcm1EYXRhJyk7XG5cbmZ1bmN0aW9uIEF4aW9zKGRlZmF1bHRDb25maWcpIHtcbiAgdGhpcy5kZWZhdWx0cyA9IHV0aWxzLm1lcmdlKHt9LCBkZWZhdWx0Q29uZmlnKTtcbiAgdGhpcy5pbnRlcmNlcHRvcnMgPSB7XG4gICAgcmVxdWVzdDogbmV3IEludGVyY2VwdG9yTWFuYWdlcigpLFxuICAgIHJlc3BvbnNlOiBuZXcgSW50ZXJjZXB0b3JNYW5hZ2VyKClcbiAgfTtcbn1cblxuQXhpb3MucHJvdG90eXBlLnJlcXVlc3QgPSBmdW5jdGlvbiByZXF1ZXN0KGNvbmZpZykge1xuICAvKmVzbGludCBuby1wYXJhbS1yZWFzc2lnbjowKi9cbiAgLy8gQWxsb3cgZm9yIGF4aW9zKCdleGFtcGxlL3VybCdbLCBjb25maWddKSBhIGxhIGZldGNoIEFQSVxuICBpZiAodHlwZW9mIGNvbmZpZyA9PT0gJ3N0cmluZycpIHtcbiAgICBjb25maWcgPSB1dGlscy5tZXJnZSh7XG4gICAgICB1cmw6IGFyZ3VtZW50c1swXVxuICAgIH0sIGFyZ3VtZW50c1sxXSk7XG4gIH1cblxuICBjb25maWcgPSB1dGlscy5tZXJnZShkZWZhdWx0cywgdGhpcy5kZWZhdWx0cywgeyBtZXRob2Q6ICdnZXQnIH0sIGNvbmZpZyk7XG5cbiAgLy8gU3VwcG9ydCBiYXNlVVJMIGNvbmZpZ1xuICBpZiAoY29uZmlnLmJhc2VVUkwgJiYgIWlzQWJzb2x1dGVVUkwoY29uZmlnLnVybCkpIHtcbiAgICBjb25maWcudXJsID0gY29tYmluZVVSTHMoY29uZmlnLmJhc2VVUkwsIGNvbmZpZy51cmwpO1xuICB9XG5cbiAgLy8gRG9uJ3QgYWxsb3cgb3ZlcnJpZGluZyBkZWZhdWx0cy53aXRoQ3JlZGVudGlhbHNcbiAgY29uZmlnLndpdGhDcmVkZW50aWFscyA9IGNvbmZpZy53aXRoQ3JlZGVudGlhbHMgfHwgdGhpcy5kZWZhdWx0cy53aXRoQ3JlZGVudGlhbHM7XG5cbiAgLy8gVHJhbnNmb3JtIHJlcXVlc3QgZGF0YVxuICBjb25maWcuZGF0YSA9IHRyYW5zZm9ybURhdGEoXG4gICAgY29uZmlnLmRhdGEsXG4gICAgY29uZmlnLmhlYWRlcnMsXG4gICAgY29uZmlnLnRyYW5zZm9ybVJlcXVlc3RcbiAgKTtcblxuICAvLyBGbGF0dGVuIGhlYWRlcnNcbiAgY29uZmlnLmhlYWRlcnMgPSB1dGlscy5tZXJnZShcbiAgICBjb25maWcuaGVhZGVycy5jb21tb24gfHwge30sXG4gICAgY29uZmlnLmhlYWRlcnNbY29uZmlnLm1ldGhvZF0gfHwge30sXG4gICAgY29uZmlnLmhlYWRlcnMgfHwge31cbiAgKTtcblxuICB1dGlscy5mb3JFYWNoKFxuICAgIFsnZGVsZXRlJywgJ2dldCcsICdoZWFkJywgJ3Bvc3QnLCAncHV0JywgJ3BhdGNoJywgJ2NvbW1vbiddLFxuICAgIGZ1bmN0aW9uIGNsZWFuSGVhZGVyQ29uZmlnKG1ldGhvZCkge1xuICAgICAgZGVsZXRlIGNvbmZpZy5oZWFkZXJzW21ldGhvZF07XG4gICAgfVxuICApO1xuXG4gIC8vIEhvb2sgdXAgaW50ZXJjZXB0b3JzIG1pZGRsZXdhcmVcbiAgdmFyIGNoYWluID0gW2Rpc3BhdGNoUmVxdWVzdCwgdW5kZWZpbmVkXTtcbiAgdmFyIHByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoY29uZmlnKTtcblxuICB0aGlzLmludGVyY2VwdG9ycy5yZXF1ZXN0LmZvckVhY2goZnVuY3Rpb24gdW5zaGlmdFJlcXVlc3RJbnRlcmNlcHRvcnMoaW50ZXJjZXB0b3IpIHtcbiAgICBjaGFpbi51bnNoaWZ0KGludGVyY2VwdG9yLmZ1bGZpbGxlZCwgaW50ZXJjZXB0b3IucmVqZWN0ZWQpO1xuICB9KTtcblxuICB0aGlzLmludGVyY2VwdG9ycy5yZXNwb25zZS5mb3JFYWNoKGZ1bmN0aW9uIHB1c2hSZXNwb25zZUludGVyY2VwdG9ycyhpbnRlcmNlcHRvcikge1xuICAgIGNoYWluLnB1c2goaW50ZXJjZXB0b3IuZnVsZmlsbGVkLCBpbnRlcmNlcHRvci5yZWplY3RlZCk7XG4gIH0pO1xuXG4gIHdoaWxlIChjaGFpbi5sZW5ndGgpIHtcbiAgICBwcm9taXNlID0gcHJvbWlzZS50aGVuKGNoYWluLnNoaWZ0KCksIGNoYWluLnNoaWZ0KCkpO1xuICB9XG5cbiAgcmV0dXJuIHByb21pc2U7XG59O1xuXG52YXIgZGVmYXVsdEluc3RhbmNlID0gbmV3IEF4aW9zKGRlZmF1bHRzKTtcbnZhciBheGlvcyA9IG1vZHVsZS5leHBvcnRzID0gYmluZChBeGlvcy5wcm90b3R5cGUucmVxdWVzdCwgZGVmYXVsdEluc3RhbmNlKTtcblxuYXhpb3MuY3JlYXRlID0gZnVuY3Rpb24gY3JlYXRlKGRlZmF1bHRDb25maWcpIHtcbiAgcmV0dXJuIG5ldyBBeGlvcyhkZWZhdWx0Q29uZmlnKTtcbn07XG5cbi8vIEV4cG9zZSBkZWZhdWx0c1xuYXhpb3MuZGVmYXVsdHMgPSBkZWZhdWx0SW5zdGFuY2UuZGVmYXVsdHM7XG5cbi8vIEV4cG9zZSBhbGwvc3ByZWFkXG5heGlvcy5hbGwgPSBmdW5jdGlvbiBhbGwocHJvbWlzZXMpIHtcbiAgcmV0dXJuIFByb21pc2UuYWxsKHByb21pc2VzKTtcbn07XG5heGlvcy5zcHJlYWQgPSByZXF1aXJlKCcuL2hlbHBlcnMvc3ByZWFkJyk7XG5cbi8vIEV4cG9zZSBpbnRlcmNlcHRvcnNcbmF4aW9zLmludGVyY2VwdG9ycyA9IGRlZmF1bHRJbnN0YW5jZS5pbnRlcmNlcHRvcnM7XG5cbi8vIFByb3ZpZGUgYWxpYXNlcyBmb3Igc3VwcG9ydGVkIHJlcXVlc3QgbWV0aG9kc1xudXRpbHMuZm9yRWFjaChbJ2RlbGV0ZScsICdnZXQnLCAnaGVhZCddLCBmdW5jdGlvbiBmb3JFYWNoTWV0aG9kTm9EYXRhKG1ldGhvZCkge1xuICAvKmVzbGludCBmdW5jLW5hbWVzOjAqL1xuICBBeGlvcy5wcm90b3R5cGVbbWV0aG9kXSA9IGZ1bmN0aW9uKHVybCwgY29uZmlnKSB7XG4gICAgcmV0dXJuIHRoaXMucmVxdWVzdCh1dGlscy5tZXJnZShjb25maWcgfHwge30sIHtcbiAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgdXJsOiB1cmxcbiAgICB9KSk7XG4gIH07XG4gIGF4aW9zW21ldGhvZF0gPSBiaW5kKEF4aW9zLnByb3RvdHlwZVttZXRob2RdLCBkZWZhdWx0SW5zdGFuY2UpO1xufSk7XG5cbnV0aWxzLmZvckVhY2goWydwb3N0JywgJ3B1dCcsICdwYXRjaCddLCBmdW5jdGlvbiBmb3JFYWNoTWV0aG9kV2l0aERhdGEobWV0aG9kKSB7XG4gIC8qZXNsaW50IGZ1bmMtbmFtZXM6MCovXG4gIEF4aW9zLnByb3RvdHlwZVttZXRob2RdID0gZnVuY3Rpb24odXJsLCBkYXRhLCBjb25maWcpIHtcbiAgICByZXR1cm4gdGhpcy5yZXF1ZXN0KHV0aWxzLm1lcmdlKGNvbmZpZyB8fCB7fSwge1xuICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICB1cmw6IHVybCxcbiAgICAgIGRhdGE6IGRhdGFcbiAgICB9KSk7XG4gIH07XG4gIGF4aW9zW21ldGhvZF0gPSBiaW5kKEF4aW9zLnByb3RvdHlwZVttZXRob2RdLCBkZWZhdWx0SW5zdGFuY2UpO1xufSk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vLi4vdXRpbHMnKTtcblxuZnVuY3Rpb24gSW50ZXJjZXB0b3JNYW5hZ2VyKCkge1xuICB0aGlzLmhhbmRsZXJzID0gW107XG59XG5cbi8qKlxuICogQWRkIGEgbmV3IGludGVyY2VwdG9yIHRvIHRoZSBzdGFja1xuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bGZpbGxlZCBUaGUgZnVuY3Rpb24gdG8gaGFuZGxlIGB0aGVuYCBmb3IgYSBgUHJvbWlzZWBcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHJlamVjdGVkIFRoZSBmdW5jdGlvbiB0byBoYW5kbGUgYHJlamVjdGAgZm9yIGEgYFByb21pc2VgXG4gKlxuICogQHJldHVybiB7TnVtYmVyfSBBbiBJRCB1c2VkIHRvIHJlbW92ZSBpbnRlcmNlcHRvciBsYXRlclxuICovXG5JbnRlcmNlcHRvck1hbmFnZXIucHJvdG90eXBlLnVzZSA9IGZ1bmN0aW9uIHVzZShmdWxmaWxsZWQsIHJlamVjdGVkKSB7XG4gIHRoaXMuaGFuZGxlcnMucHVzaCh7XG4gICAgZnVsZmlsbGVkOiBmdWxmaWxsZWQsXG4gICAgcmVqZWN0ZWQ6IHJlamVjdGVkXG4gIH0pO1xuICByZXR1cm4gdGhpcy5oYW5kbGVycy5sZW5ndGggLSAxO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgYW4gaW50ZXJjZXB0b3IgZnJvbSB0aGUgc3RhY2tcbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gaWQgVGhlIElEIHRoYXQgd2FzIHJldHVybmVkIGJ5IGB1c2VgXG4gKi9cbkludGVyY2VwdG9yTWFuYWdlci5wcm90b3R5cGUuZWplY3QgPSBmdW5jdGlvbiBlamVjdChpZCkge1xuICBpZiAodGhpcy5oYW5kbGVyc1tpZF0pIHtcbiAgICB0aGlzLmhhbmRsZXJzW2lkXSA9IG51bGw7XG4gIH1cbn07XG5cbi8qKlxuICogSXRlcmF0ZSBvdmVyIGFsbCB0aGUgcmVnaXN0ZXJlZCBpbnRlcmNlcHRvcnNcbiAqXG4gKiBUaGlzIG1ldGhvZCBpcyBwYXJ0aWN1bGFybHkgdXNlZnVsIGZvciBza2lwcGluZyBvdmVyIGFueVxuICogaW50ZXJjZXB0b3JzIHRoYXQgbWF5IGhhdmUgYmVjb21lIGBudWxsYCBjYWxsaW5nIGBlamVjdGAuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm4gVGhlIGZ1bmN0aW9uIHRvIGNhbGwgZm9yIGVhY2ggaW50ZXJjZXB0b3JcbiAqL1xuSW50ZXJjZXB0b3JNYW5hZ2VyLnByb3RvdHlwZS5mb3JFYWNoID0gZnVuY3Rpb24gZm9yRWFjaChmbikge1xuICB1dGlscy5mb3JFYWNoKHRoaXMuaGFuZGxlcnMsIGZ1bmN0aW9uIGZvckVhY2hIYW5kbGVyKGgpIHtcbiAgICBpZiAoaCAhPT0gbnVsbCkge1xuICAgICAgZm4oaCk7XG4gICAgfVxuICB9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gSW50ZXJjZXB0b3JNYW5hZ2VyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIERpc3BhdGNoIGEgcmVxdWVzdCB0byB0aGUgc2VydmVyIHVzaW5nIHdoaWNoZXZlciBhZGFwdGVyXG4gKiBpcyBzdXBwb3J0ZWQgYnkgdGhlIGN1cnJlbnQgZW52aXJvbm1lbnQuXG4gKlxuICogQHBhcmFtIHtvYmplY3R9IGNvbmZpZyBUaGUgY29uZmlnIHRoYXQgaXMgdG8gYmUgdXNlZCBmb3IgdGhlIHJlcXVlc3RcbiAqIEByZXR1cm5zIHtQcm9taXNlfSBUaGUgUHJvbWlzZSB0byBiZSBmdWxmaWxsZWRcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBkaXNwYXRjaFJlcXVlc3QoY29uZmlnKSB7XG4gIHJldHVybiBuZXcgUHJvbWlzZShmdW5jdGlvbiBleGVjdXRvcihyZXNvbHZlLCByZWplY3QpIHtcbiAgICB0cnkge1xuICAgICAgdmFyIGFkYXB0ZXI7XG5cbiAgICAgIGlmICh0eXBlb2YgY29uZmlnLmFkYXB0ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gRm9yIGN1c3RvbSBhZGFwdGVyIHN1cHBvcnRcbiAgICAgICAgYWRhcHRlciA9IGNvbmZpZy5hZGFwdGVyO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgWE1MSHR0cFJlcXVlc3QgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIC8vIEZvciBicm93c2VycyB1c2UgWEhSIGFkYXB0ZXJcbiAgICAgICAgYWRhcHRlciA9IHJlcXVpcmUoJy4uL2FkYXB0ZXJzL3hocicpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgLy8gRm9yIG5vZGUgdXNlIEhUVFAgYWRhcHRlclxuICAgICAgICBhZGFwdGVyID0gcmVxdWlyZSgnLi4vYWRhcHRlcnMvaHR0cCcpO1xuICAgICAgfVxuXG4gICAgICBpZiAodHlwZW9mIGFkYXB0ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgYWRhcHRlcihyZXNvbHZlLCByZWplY3QsIGNvbmZpZyk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgcmVqZWN0KGUpO1xuICAgIH1cbiAgfSk7XG59O1xuXG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoJy4vdXRpbHMnKTtcblxudmFyIFBST1RFQ1RJT05fUFJFRklYID0gL15cXClcXF1cXH0nLD9cXG4vO1xudmFyIERFRkFVTFRfQ09OVEVOVF9UWVBFID0ge1xuICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCdcbn07XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICB0cmFuc2Zvcm1SZXF1ZXN0OiBbZnVuY3Rpb24gdHJhbnNmb3JtUmVzcG9uc2VKU09OKGRhdGEsIGhlYWRlcnMpIHtcbiAgICBpZiAodXRpbHMuaXNGb3JtRGF0YShkYXRhKSkge1xuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfVxuICAgIGlmICh1dGlscy5pc0FycmF5QnVmZmVyKGRhdGEpKSB7XG4gICAgICByZXR1cm4gZGF0YTtcbiAgICB9XG4gICAgaWYgKHV0aWxzLmlzQXJyYXlCdWZmZXJWaWV3KGRhdGEpKSB7XG4gICAgICByZXR1cm4gZGF0YS5idWZmZXI7XG4gICAgfVxuICAgIGlmICh1dGlscy5pc09iamVjdChkYXRhKSAmJiAhdXRpbHMuaXNGaWxlKGRhdGEpICYmICF1dGlscy5pc0Jsb2IoZGF0YSkpIHtcbiAgICAgIC8vIFNldCBhcHBsaWNhdGlvbi9qc29uIGlmIG5vIENvbnRlbnQtVHlwZSBoYXMgYmVlbiBzcGVjaWZpZWRcbiAgICAgIGlmICghdXRpbHMuaXNVbmRlZmluZWQoaGVhZGVycykpIHtcbiAgICAgICAgdXRpbHMuZm9yRWFjaChoZWFkZXJzLCBmdW5jdGlvbiBwcm9jZXNzQ29udGVudFR5cGVIZWFkZXIodmFsLCBrZXkpIHtcbiAgICAgICAgICBpZiAoa2V5LnRvTG93ZXJDYXNlKCkgPT09ICdjb250ZW50LXR5cGUnKSB7XG4gICAgICAgICAgICBoZWFkZXJzWydDb250ZW50LVR5cGUnXSA9IHZhbDtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICh1dGlscy5pc1VuZGVmaW5lZChoZWFkZXJzWydDb250ZW50LVR5cGUnXSkpIHtcbiAgICAgICAgICBoZWFkZXJzWydDb250ZW50LVR5cGUnXSA9ICdhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTgnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoZGF0YSk7XG4gICAgfVxuICAgIHJldHVybiBkYXRhO1xuICB9XSxcblxuICB0cmFuc2Zvcm1SZXNwb25zZTogW2Z1bmN0aW9uIHRyYW5zZm9ybVJlc3BvbnNlSlNPTihkYXRhKSB7XG4gICAgLyplc2xpbnQgbm8tcGFyYW0tcmVhc3NpZ246MCovXG4gICAgaWYgKHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJykge1xuICAgICAgZGF0YSA9IGRhdGEucmVwbGFjZShQUk9URUNUSU9OX1BSRUZJWCwgJycpO1xuICAgICAgdHJ5IHtcbiAgICAgICAgZGF0YSA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICB9IGNhdGNoIChlKSB7IC8qIElnbm9yZSAqLyB9XG4gICAgfVxuICAgIHJldHVybiBkYXRhO1xuICB9XSxcblxuICBoZWFkZXJzOiB7XG4gICAgY29tbW9uOiB7XG4gICAgICAnQWNjZXB0JzogJ2FwcGxpY2F0aW9uL2pzb24sIHRleHQvcGxhaW4sICovKidcbiAgICB9LFxuICAgIHBhdGNoOiB1dGlscy5tZXJnZShERUZBVUxUX0NPTlRFTlRfVFlQRSksXG4gICAgcG9zdDogdXRpbHMubWVyZ2UoREVGQVVMVF9DT05URU5UX1RZUEUpLFxuICAgIHB1dDogdXRpbHMubWVyZ2UoREVGQVVMVF9DT05URU5UX1RZUEUpXG4gIH0sXG5cbiAgdGltZW91dDogMCxcblxuICB4c3JmQ29va2llTmFtZTogJ1hTUkYtVE9LRU4nLFxuICB4c3JmSGVhZGVyTmFtZTogJ1gtWFNSRi1UT0tFTidcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYmluZChmbiwgdGhpc0FyZykge1xuICByZXR1cm4gZnVuY3Rpb24gd3JhcCgpIHtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShhcmd1bWVudHMubGVuZ3RoKTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3MubGVuZ3RoOyBpKyspIHtcbiAgICAgIGFyZ3NbaV0gPSBhcmd1bWVudHNbaV07XG4gICAgfVxuICAgIHJldHVybiBmbi5hcHBseSh0aGlzQXJnLCBhcmdzKTtcbiAgfTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIGJ0b2EgcG9seWZpbGwgZm9yIElFPDEwIGNvdXJ0ZXN5IGh0dHBzOi8vZ2l0aHViLmNvbS9kYXZpZGNoYW1iZXJzL0Jhc2U2NC5qc1xuXG52YXIgY2hhcnMgPSAnQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJzdHV2d3h5ejAxMjM0NTY3ODkrLz0nO1xuXG5mdW5jdGlvbiBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IobWVzc2FnZSkge1xuICB0aGlzLm1lc3NhZ2UgPSBtZXNzYWdlO1xufVxuSW52YWxpZENoYXJhY3RlckVycm9yLnByb3RvdHlwZSA9IG5ldyBFcnJvcjtcbkludmFsaWRDaGFyYWN0ZXJFcnJvci5wcm90b3R5cGUuY29kZSA9IDU7XG5JbnZhbGlkQ2hhcmFjdGVyRXJyb3IucHJvdG90eXBlLm5hbWUgPSAnSW52YWxpZENoYXJhY3RlckVycm9yJztcblxuZnVuY3Rpb24gYnRvYShpbnB1dCkge1xuICB2YXIgc3RyID0gU3RyaW5nKGlucHV0KTtcbiAgdmFyIG91dHB1dCA9ICcnO1xuICBmb3IgKFxuICAgIC8vIGluaXRpYWxpemUgcmVzdWx0IGFuZCBjb3VudGVyXG4gICAgdmFyIGJsb2NrLCBjaGFyQ29kZSwgaWR4ID0gMCwgbWFwID0gY2hhcnM7XG4gICAgLy8gaWYgdGhlIG5leHQgc3RyIGluZGV4IGRvZXMgbm90IGV4aXN0OlxuICAgIC8vICAgY2hhbmdlIHRoZSBtYXBwaW5nIHRhYmxlIHRvIFwiPVwiXG4gICAgLy8gICBjaGVjayBpZiBkIGhhcyBubyBmcmFjdGlvbmFsIGRpZ2l0c1xuICAgIHN0ci5jaGFyQXQoaWR4IHwgMCkgfHwgKG1hcCA9ICc9JywgaWR4ICUgMSk7XG4gICAgLy8gXCI4IC0gaWR4ICUgMSAqIDhcIiBnZW5lcmF0ZXMgdGhlIHNlcXVlbmNlIDIsIDQsIDYsIDhcbiAgICBvdXRwdXQgKz0gbWFwLmNoYXJBdCg2MyAmIGJsb2NrID4+IDggLSBpZHggJSAxICogOClcbiAgKSB7XG4gICAgY2hhckNvZGUgPSBzdHIuY2hhckNvZGVBdChpZHggKz0gMyAvIDQpO1xuICAgIGlmIChjaGFyQ29kZSA+IDB4RkYpIHtcbiAgICAgIHRocm93IG5ldyBJbnZhbGlkQ2hhcmFjdGVyRXJyb3IoJ0lOVkFMSURfQ0hBUkFDVEVSX0VSUjogRE9NIEV4Y2VwdGlvbiA1Jyk7XG4gICAgfVxuICAgIGJsb2NrID0gYmxvY2sgPDwgOCB8IGNoYXJDb2RlO1xuICB9XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnRvYTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xuXG5mdW5jdGlvbiBlbmNvZGUodmFsKSB7XG4gIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQodmFsKS5cbiAgICByZXBsYWNlKC8lNDAvZ2ksICdAJykuXG4gICAgcmVwbGFjZSgvJTNBL2dpLCAnOicpLlxuICAgIHJlcGxhY2UoLyUyNC9nLCAnJCcpLlxuICAgIHJlcGxhY2UoLyUyQy9naSwgJywnKS5cbiAgICByZXBsYWNlKC8lMjAvZywgJysnKS5cbiAgICByZXBsYWNlKC8lNUIvZ2ksICdbJykuXG4gICAgcmVwbGFjZSgvJTVEL2dpLCAnXScpO1xufVxuXG4vKipcbiAqIEJ1aWxkIGEgVVJMIGJ5IGFwcGVuZGluZyBwYXJhbXMgdG8gdGhlIGVuZFxuICpcbiAqIEBwYXJhbSB7c3RyaW5nfSB1cmwgVGhlIGJhc2Ugb2YgdGhlIHVybCAoZS5nLiwgaHR0cDovL3d3dy5nb29nbGUuY29tKVxuICogQHBhcmFtIHtvYmplY3R9IFtwYXJhbXNdIFRoZSBwYXJhbXMgdG8gYmUgYXBwZW5kZWRcbiAqIEByZXR1cm5zIHtzdHJpbmd9IFRoZSBmb3JtYXR0ZWQgdXJsXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYnVpbGRVUkwodXJsLCBwYXJhbXMsIHBhcmFtc1NlcmlhbGl6ZXIpIHtcbiAgLyplc2xpbnQgbm8tcGFyYW0tcmVhc3NpZ246MCovXG4gIGlmICghcGFyYW1zKSB7XG4gICAgcmV0dXJuIHVybDtcbiAgfVxuXG4gIHZhciBzZXJpYWxpemVkUGFyYW1zO1xuICBpZiAocGFyYW1zU2VyaWFsaXplcikge1xuICAgIHNlcmlhbGl6ZWRQYXJhbXMgPSBwYXJhbXNTZXJpYWxpemVyKHBhcmFtcyk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIHBhcnRzID0gW107XG5cbiAgICB1dGlscy5mb3JFYWNoKHBhcmFtcywgZnVuY3Rpb24gc2VyaWFsaXplKHZhbCwga2V5KSB7XG4gICAgICBpZiAodmFsID09PSBudWxsIHx8IHR5cGVvZiB2YWwgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKHV0aWxzLmlzQXJyYXkodmFsKSkge1xuICAgICAgICBrZXkgPSBrZXkgKyAnW10nO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXV0aWxzLmlzQXJyYXkodmFsKSkge1xuICAgICAgICB2YWwgPSBbdmFsXTtcbiAgICAgIH1cblxuICAgICAgdXRpbHMuZm9yRWFjaCh2YWwsIGZ1bmN0aW9uIHBhcnNlVmFsdWUodikge1xuICAgICAgICBpZiAodXRpbHMuaXNEYXRlKHYpKSB7XG4gICAgICAgICAgdiA9IHYudG9JU09TdHJpbmcoKTtcbiAgICAgICAgfSBlbHNlIGlmICh1dGlscy5pc09iamVjdCh2KSkge1xuICAgICAgICAgIHYgPSBKU09OLnN0cmluZ2lmeSh2KTtcbiAgICAgICAgfVxuICAgICAgICBwYXJ0cy5wdXNoKGVuY29kZShrZXkpICsgJz0nICsgZW5jb2RlKHYpKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgc2VyaWFsaXplZFBhcmFtcyA9IHBhcnRzLmpvaW4oJyYnKTtcbiAgfVxuXG4gIGlmIChzZXJpYWxpemVkUGFyYW1zKSB7XG4gICAgdXJsICs9ICh1cmwuaW5kZXhPZignPycpID09PSAtMSA/ICc/JyA6ICcmJykgKyBzZXJpYWxpemVkUGFyYW1zO1xuICB9XG5cbiAgcmV0dXJuIHVybDtcbn07XG5cbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBDcmVhdGVzIGEgbmV3IFVSTCBieSBjb21iaW5pbmcgdGhlIHNwZWNpZmllZCBVUkxzXG4gKlxuICogQHBhcmFtIHtzdHJpbmd9IGJhc2VVUkwgVGhlIGJhc2UgVVJMXG4gKiBAcGFyYW0ge3N0cmluZ30gcmVsYXRpdmVVUkwgVGhlIHJlbGF0aXZlIFVSTFxuICogQHJldHVybnMge3N0cmluZ30gVGhlIGNvbWJpbmVkIFVSTFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGNvbWJpbmVVUkxzKGJhc2VVUkwsIHJlbGF0aXZlVVJMKSB7XG4gIHJldHVybiBiYXNlVVJMLnJlcGxhY2UoL1xcLyskLywgJycpICsgJy8nICsgcmVsYXRpdmVVUkwucmVwbGFjZSgvXlxcLysvLCAnJyk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKFxuICB1dGlscy5pc1N0YW5kYXJkQnJvd3NlckVudigpID9cblxuICAvLyBTdGFuZGFyZCBicm93c2VyIGVudnMgc3VwcG9ydCBkb2N1bWVudC5jb29raWVcbiAgKGZ1bmN0aW9uIHN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICByZXR1cm4ge1xuICAgICAgd3JpdGU6IGZ1bmN0aW9uIHdyaXRlKG5hbWUsIHZhbHVlLCBleHBpcmVzLCBwYXRoLCBkb21haW4sIHNlY3VyZSkge1xuICAgICAgICB2YXIgY29va2llID0gW107XG4gICAgICAgIGNvb2tpZS5wdXNoKG5hbWUgKyAnPScgKyBlbmNvZGVVUklDb21wb25lbnQodmFsdWUpKTtcblxuICAgICAgICBpZiAodXRpbHMuaXNOdW1iZXIoZXhwaXJlcykpIHtcbiAgICAgICAgICBjb29raWUucHVzaCgnZXhwaXJlcz0nICsgbmV3IERhdGUoZXhwaXJlcykudG9HTVRTdHJpbmcoKSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodXRpbHMuaXNTdHJpbmcocGF0aCkpIHtcbiAgICAgICAgICBjb29raWUucHVzaCgncGF0aD0nICsgcGF0aCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodXRpbHMuaXNTdHJpbmcoZG9tYWluKSkge1xuICAgICAgICAgIGNvb2tpZS5wdXNoKCdkb21haW49JyArIGRvbWFpbik7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2VjdXJlID09PSB0cnVlKSB7XG4gICAgICAgICAgY29va2llLnB1c2goJ3NlY3VyZScpO1xuICAgICAgICB9XG5cbiAgICAgICAgZG9jdW1lbnQuY29va2llID0gY29va2llLmpvaW4oJzsgJyk7XG4gICAgICB9LFxuXG4gICAgICByZWFkOiBmdW5jdGlvbiByZWFkKG5hbWUpIHtcbiAgICAgICAgdmFyIG1hdGNoID0gZG9jdW1lbnQuY29va2llLm1hdGNoKG5ldyBSZWdFeHAoJyhefDtcXFxccyopKCcgKyBuYW1lICsgJyk9KFteO10qKScpKTtcbiAgICAgICAgcmV0dXJuIChtYXRjaCA/IGRlY29kZVVSSUNvbXBvbmVudChtYXRjaFszXSkgOiBudWxsKTtcbiAgICAgIH0sXG5cbiAgICAgIHJlbW92ZTogZnVuY3Rpb24gcmVtb3ZlKG5hbWUpIHtcbiAgICAgICAgdGhpcy53cml0ZShuYW1lLCAnJywgRGF0ZS5ub3coKSAtIDg2NDAwMDAwKTtcbiAgICAgIH1cbiAgICB9O1xuICB9KSgpIDpcblxuICAvLyBOb24gc3RhbmRhcmQgYnJvd3NlciBlbnYgKHdlYiB3b3JrZXJzLCByZWFjdC1uYXRpdmUpIGxhY2sgbmVlZGVkIHN1cHBvcnQuXG4gIChmdW5jdGlvbiBub25TdGFuZGFyZEJyb3dzZXJFbnYoKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIHdyaXRlOiBmdW5jdGlvbiB3cml0ZSgpIHt9LFxuICAgICAgcmVhZDogZnVuY3Rpb24gcmVhZCgpIHsgcmV0dXJuIG51bGw7IH0sXG4gICAgICByZW1vdmU6IGZ1bmN0aW9uIHJlbW92ZSgpIHt9XG4gICAgfTtcbiAgfSkoKVxuKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBEZXRlcm1pbmVzIHdoZXRoZXIgdGhlIHNwZWNpZmllZCBVUkwgaXMgYWJzb2x1dGVcbiAqXG4gKiBAcGFyYW0ge3N0cmluZ30gdXJsIFRoZSBVUkwgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdGhlIHNwZWNpZmllZCBVUkwgaXMgYWJzb2x1dGUsIG90aGVyd2lzZSBmYWxzZVxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGlzQWJzb2x1dGVVUkwodXJsKSB7XG4gIC8vIEEgVVJMIGlzIGNvbnNpZGVyZWQgYWJzb2x1dGUgaWYgaXQgYmVnaW5zIHdpdGggXCI8c2NoZW1lPjovL1wiIG9yIFwiLy9cIiAocHJvdG9jb2wtcmVsYXRpdmUgVVJMKS5cbiAgLy8gUkZDIDM5ODYgZGVmaW5lcyBzY2hlbWUgbmFtZSBhcyBhIHNlcXVlbmNlIG9mIGNoYXJhY3RlcnMgYmVnaW5uaW5nIHdpdGggYSBsZXR0ZXIgYW5kIGZvbGxvd2VkXG4gIC8vIGJ5IGFueSBjb21iaW5hdGlvbiBvZiBsZXR0ZXJzLCBkaWdpdHMsIHBsdXMsIHBlcmlvZCwgb3IgaHlwaGVuLlxuICByZXR1cm4gL14oW2Etel1bYS16XFxkXFwrXFwtXFwuXSo6KT9cXC9cXC8vaS50ZXN0KHVybCk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLy4uL3V0aWxzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gKFxuICB1dGlscy5pc1N0YW5kYXJkQnJvd3NlckVudigpID9cblxuICAvLyBTdGFuZGFyZCBicm93c2VyIGVudnMgaGF2ZSBmdWxsIHN1cHBvcnQgb2YgdGhlIEFQSXMgbmVlZGVkIHRvIHRlc3RcbiAgLy8gd2hldGhlciB0aGUgcmVxdWVzdCBVUkwgaXMgb2YgdGhlIHNhbWUgb3JpZ2luIGFzIGN1cnJlbnQgbG9jYXRpb24uXG4gIChmdW5jdGlvbiBzdGFuZGFyZEJyb3dzZXJFbnYoKSB7XG4gICAgdmFyIG1zaWUgPSAvKG1zaWV8dHJpZGVudCkvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpO1xuICAgIHZhciB1cmxQYXJzaW5nTm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgICB2YXIgb3JpZ2luVVJMO1xuXG4gICAgLyoqXG4gICAgKiBQYXJzZSBhIFVSTCB0byBkaXNjb3ZlciBpdCdzIGNvbXBvbmVudHNcbiAgICAqXG4gICAgKiBAcGFyYW0ge1N0cmluZ30gdXJsIFRoZSBVUkwgdG8gYmUgcGFyc2VkXG4gICAgKiBAcmV0dXJucyB7T2JqZWN0fVxuICAgICovXG4gICAgZnVuY3Rpb24gcmVzb2x2ZVVSTCh1cmwpIHtcbiAgICAgIHZhciBocmVmID0gdXJsO1xuXG4gICAgICBpZiAobXNpZSkge1xuICAgICAgICAvLyBJRSBuZWVkcyBhdHRyaWJ1dGUgc2V0IHR3aWNlIHRvIG5vcm1hbGl6ZSBwcm9wZXJ0aWVzXG4gICAgICAgIHVybFBhcnNpbmdOb2RlLnNldEF0dHJpYnV0ZSgnaHJlZicsIGhyZWYpO1xuICAgICAgICBocmVmID0gdXJsUGFyc2luZ05vZGUuaHJlZjtcbiAgICAgIH1cblxuICAgICAgdXJsUGFyc2luZ05vZGUuc2V0QXR0cmlidXRlKCdocmVmJywgaHJlZik7XG5cbiAgICAgIC8vIHVybFBhcnNpbmdOb2RlIHByb3ZpZGVzIHRoZSBVcmxVdGlscyBpbnRlcmZhY2UgLSBodHRwOi8vdXJsLnNwZWMud2hhdHdnLm9yZy8jdXJsdXRpbHNcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGhyZWY6IHVybFBhcnNpbmdOb2RlLmhyZWYsXG4gICAgICAgIHByb3RvY29sOiB1cmxQYXJzaW5nTm9kZS5wcm90b2NvbCA/IHVybFBhcnNpbmdOb2RlLnByb3RvY29sLnJlcGxhY2UoLzokLywgJycpIDogJycsXG4gICAgICAgIGhvc3Q6IHVybFBhcnNpbmdOb2RlLmhvc3QsXG4gICAgICAgIHNlYXJjaDogdXJsUGFyc2luZ05vZGUuc2VhcmNoID8gdXJsUGFyc2luZ05vZGUuc2VhcmNoLnJlcGxhY2UoL15cXD8vLCAnJykgOiAnJyxcbiAgICAgICAgaGFzaDogdXJsUGFyc2luZ05vZGUuaGFzaCA/IHVybFBhcnNpbmdOb2RlLmhhc2gucmVwbGFjZSgvXiMvLCAnJykgOiAnJyxcbiAgICAgICAgaG9zdG5hbWU6IHVybFBhcnNpbmdOb2RlLmhvc3RuYW1lLFxuICAgICAgICBwb3J0OiB1cmxQYXJzaW5nTm9kZS5wb3J0LFxuICAgICAgICBwYXRobmFtZTogKHVybFBhcnNpbmdOb2RlLnBhdGhuYW1lLmNoYXJBdCgwKSA9PT0gJy8nKSA/XG4gICAgICAgICAgICAgICAgICB1cmxQYXJzaW5nTm9kZS5wYXRobmFtZSA6XG4gICAgICAgICAgICAgICAgICAnLycgKyB1cmxQYXJzaW5nTm9kZS5wYXRobmFtZVxuICAgICAgfTtcbiAgICB9XG5cbiAgICBvcmlnaW5VUkwgPSByZXNvbHZlVVJMKHdpbmRvdy5sb2NhdGlvbi5ocmVmKTtcblxuICAgIC8qKlxuICAgICogRGV0ZXJtaW5lIGlmIGEgVVJMIHNoYXJlcyB0aGUgc2FtZSBvcmlnaW4gYXMgdGhlIGN1cnJlbnQgbG9jYXRpb25cbiAgICAqXG4gICAgKiBAcGFyYW0ge1N0cmluZ30gcmVxdWVzdFVSTCBUaGUgVVJMIHRvIHRlc3RcbiAgICAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIFVSTCBzaGFyZXMgdGhlIHNhbWUgb3JpZ2luLCBvdGhlcndpc2UgZmFsc2VcbiAgICAqL1xuICAgIHJldHVybiBmdW5jdGlvbiBpc1VSTFNhbWVPcmlnaW4ocmVxdWVzdFVSTCkge1xuICAgICAgdmFyIHBhcnNlZCA9ICh1dGlscy5pc1N0cmluZyhyZXF1ZXN0VVJMKSkgPyByZXNvbHZlVVJMKHJlcXVlc3RVUkwpIDogcmVxdWVzdFVSTDtcbiAgICAgIHJldHVybiAocGFyc2VkLnByb3RvY29sID09PSBvcmlnaW5VUkwucHJvdG9jb2wgJiZcbiAgICAgICAgICAgIHBhcnNlZC5ob3N0ID09PSBvcmlnaW5VUkwuaG9zdCk7XG4gICAgfTtcbiAgfSkoKSA6XG5cbiAgLy8gTm9uIHN0YW5kYXJkIGJyb3dzZXIgZW52cyAod2ViIHdvcmtlcnMsIHJlYWN0LW5hdGl2ZSkgbGFjayBuZWVkZWQgc3VwcG9ydC5cbiAgKGZ1bmN0aW9uIG5vblN0YW5kYXJkQnJvd3NlckVudigpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gaXNVUkxTYW1lT3JpZ2luKCkge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfTtcbiAgfSkoKVxuKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xuXG4vKipcbiAqIFBhcnNlIGhlYWRlcnMgaW50byBhbiBvYmplY3RcbiAqXG4gKiBgYGBcbiAqIERhdGU6IFdlZCwgMjcgQXVnIDIwMTQgMDg6NTg6NDkgR01UXG4gKiBDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb25cbiAqIENvbm5lY3Rpb246IGtlZXAtYWxpdmVcbiAqIFRyYW5zZmVyLUVuY29kaW5nOiBjaHVua2VkXG4gKiBgYGBcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gaGVhZGVycyBIZWFkZXJzIG5lZWRpbmcgdG8gYmUgcGFyc2VkXG4gKiBAcmV0dXJucyB7T2JqZWN0fSBIZWFkZXJzIHBhcnNlZCBpbnRvIGFuIG9iamVjdFxuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHBhcnNlSGVhZGVycyhoZWFkZXJzKSB7XG4gIHZhciBwYXJzZWQgPSB7fTtcbiAgdmFyIGtleTtcbiAgdmFyIHZhbDtcbiAgdmFyIGk7XG5cbiAgaWYgKCFoZWFkZXJzKSB7IHJldHVybiBwYXJzZWQ7IH1cblxuICB1dGlscy5mb3JFYWNoKGhlYWRlcnMuc3BsaXQoJ1xcbicpLCBmdW5jdGlvbiBwYXJzZXIobGluZSkge1xuICAgIGkgPSBsaW5lLmluZGV4T2YoJzonKTtcbiAgICBrZXkgPSB1dGlscy50cmltKGxpbmUuc3Vic3RyKDAsIGkpKS50b0xvd2VyQ2FzZSgpO1xuICAgIHZhbCA9IHV0aWxzLnRyaW0obGluZS5zdWJzdHIoaSArIDEpKTtcblxuICAgIGlmIChrZXkpIHtcbiAgICAgIHBhcnNlZFtrZXldID0gcGFyc2VkW2tleV0gPyBwYXJzZWRba2V5XSArICcsICcgKyB2YWwgOiB2YWw7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gcGFyc2VkO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBTeW50YWN0aWMgc3VnYXIgZm9yIGludm9raW5nIGEgZnVuY3Rpb24gYW5kIGV4cGFuZGluZyBhbiBhcnJheSBmb3IgYXJndW1lbnRzLlxuICpcbiAqIENvbW1vbiB1c2UgY2FzZSB3b3VsZCBiZSB0byB1c2UgYEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseWAuXG4gKlxuICogIGBgYGpzXG4gKiAgZnVuY3Rpb24gZih4LCB5LCB6KSB7fVxuICogIHZhciBhcmdzID0gWzEsIDIsIDNdO1xuICogIGYuYXBwbHkobnVsbCwgYXJncyk7XG4gKiAgYGBgXG4gKlxuICogV2l0aCBgc3ByZWFkYCB0aGlzIGV4YW1wbGUgY2FuIGJlIHJlLXdyaXR0ZW4uXG4gKlxuICogIGBgYGpzXG4gKiAgc3ByZWFkKGZ1bmN0aW9uKHgsIHksIHopIHt9KShbMSwgMiwgM10pO1xuICogIGBgYFxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcmV0dXJucyB7RnVuY3Rpb259XG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc3ByZWFkKGNhbGxiYWNrKSB7XG4gIHJldHVybiBmdW5jdGlvbiB3cmFwKGFycikge1xuICAgIHJldHVybiBjYWxsYmFjay5hcHBseShudWxsLCBhcnIpO1xuICB9O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHV0aWxzID0gcmVxdWlyZSgnLi8uLi91dGlscycpO1xuXG4vKipcbiAqIFRyYW5zZm9ybSB0aGUgZGF0YSBmb3IgYSByZXF1ZXN0IG9yIGEgcmVzcG9uc2VcbiAqXG4gKiBAcGFyYW0ge09iamVjdHxTdHJpbmd9IGRhdGEgVGhlIGRhdGEgdG8gYmUgdHJhbnNmb3JtZWRcbiAqIEBwYXJhbSB7QXJyYXl9IGhlYWRlcnMgVGhlIGhlYWRlcnMgZm9yIHRoZSByZXF1ZXN0IG9yIHJlc3BvbnNlXG4gKiBAcGFyYW0ge0FycmF5fEZ1bmN0aW9ufSBmbnMgQSBzaW5nbGUgZnVuY3Rpb24gb3IgQXJyYXkgb2YgZnVuY3Rpb25zXG4gKiBAcmV0dXJucyB7Kn0gVGhlIHJlc3VsdGluZyB0cmFuc2Zvcm1lZCBkYXRhXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gdHJhbnNmb3JtRGF0YShkYXRhLCBoZWFkZXJzLCBmbnMpIHtcbiAgLyplc2xpbnQgbm8tcGFyYW0tcmVhc3NpZ246MCovXG4gIHV0aWxzLmZvckVhY2goZm5zLCBmdW5jdGlvbiB0cmFuc2Zvcm0oZm4pIHtcbiAgICBkYXRhID0gZm4oZGF0YSwgaGVhZGVycyk7XG4gIH0pO1xuXG4gIHJldHVybiBkYXRhO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLypnbG9iYWwgdG9TdHJpbmc6dHJ1ZSovXG5cbi8vIHV0aWxzIGlzIGEgbGlicmFyeSBvZiBnZW5lcmljIGhlbHBlciBmdW5jdGlvbnMgbm9uLXNwZWNpZmljIHRvIGF4aW9zXG5cbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYW4gQXJyYXlcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhbiBBcnJheSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXkodmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IEFycmF5XSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYW4gQXJyYXlCdWZmZXJcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhbiBBcnJheUJ1ZmZlciwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQXJyYXlCdWZmZXIodmFsKSB7XG4gIHJldHVybiB0b1N0cmluZy5jYWxsKHZhbCkgPT09ICdbb2JqZWN0IEFycmF5QnVmZmVyXSc7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIGEgdmFsdWUgaXMgYSBGb3JtRGF0YVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGFuIEZvcm1EYXRhLCBvdGhlcndpc2UgZmFsc2VcbiAqL1xuZnVuY3Rpb24gaXNGb3JtRGF0YSh2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgRm9ybURhdGFdJztcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmUgaWYgYSB2YWx1ZSBpcyBhIHZpZXcgb24gYW4gQXJyYXlCdWZmZXJcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsIFRoZSB2YWx1ZSB0byB0ZXN0XG4gKiBAcmV0dXJucyB7Ym9vbGVhbn0gVHJ1ZSBpZiB2YWx1ZSBpcyBhIHZpZXcgb24gYW4gQXJyYXlCdWZmZXIsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc0FycmF5QnVmZmVyVmlldyh2YWwpIHtcbiAgdmFyIHJlc3VsdDtcbiAgaWYgKCh0eXBlb2YgQXJyYXlCdWZmZXIgIT09ICd1bmRlZmluZWQnKSAmJiAoQXJyYXlCdWZmZXIuaXNWaWV3KSkge1xuICAgIHJlc3VsdCA9IEFycmF5QnVmZmVyLmlzVmlldyh2YWwpO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdCA9ICh2YWwpICYmICh2YWwuYnVmZmVyKSAmJiAodmFsLmJ1ZmZlciBpbnN0YW5jZW9mIEFycmF5QnVmZmVyKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgU3RyaW5nXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBTdHJpbmcsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1N0cmluZyh2YWwpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgTnVtYmVyXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbCBUaGUgdmFsdWUgdG8gdGVzdFxuICogQHJldHVybnMge2Jvb2xlYW59IFRydWUgaWYgdmFsdWUgaXMgYSBOdW1iZXIsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc051bWJlcih2YWwpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICdudW1iZXInO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIHVuZGVmaW5lZFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHRoZSB2YWx1ZSBpcyB1bmRlZmluZWQsIG90aGVyd2lzZSBmYWxzZVxuICovXG5mdW5jdGlvbiBpc1VuZGVmaW5lZCh2YWwpIHtcbiAgcmV0dXJuIHR5cGVvZiB2YWwgPT09ICd1bmRlZmluZWQnO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGFuIE9iamVjdFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGFuIE9iamVjdCwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbCkge1xuICByZXR1cm4gdmFsICE9PSBudWxsICYmIHR5cGVvZiB2YWwgPT09ICdvYmplY3QnO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgRGF0ZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgRGF0ZSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRGF0ZSh2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgRmlsZVxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgRmlsZSwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzRmlsZSh2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgRmlsZV0nO1xufVxuXG4vKipcbiAqIERldGVybWluZSBpZiBhIHZhbHVlIGlzIGEgQmxvYlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWwgVGhlIHZhbHVlIHRvIHRlc3RcbiAqIEByZXR1cm5zIHtib29sZWFufSBUcnVlIGlmIHZhbHVlIGlzIGEgQmxvYiwgb3RoZXJ3aXNlIGZhbHNlXG4gKi9cbmZ1bmN0aW9uIGlzQmxvYih2YWwpIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwodmFsKSA9PT0gJ1tvYmplY3QgQmxvYl0nO1xufVxuXG4vKipcbiAqIFRyaW0gZXhjZXNzIHdoaXRlc3BhY2Ugb2ZmIHRoZSBiZWdpbm5pbmcgYW5kIGVuZCBvZiBhIHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHIgVGhlIFN0cmluZyB0byB0cmltXG4gKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgU3RyaW5nIGZyZWVkIG9mIGV4Y2VzcyB3aGl0ZXNwYWNlXG4gKi9cbmZ1bmN0aW9uIHRyaW0oc3RyKSB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyovLCAnJykucmVwbGFjZSgvXFxzKiQvLCAnJyk7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIGlmIHdlJ3JlIHJ1bm5pbmcgaW4gYSBzdGFuZGFyZCBicm93c2VyIGVudmlyb25tZW50XG4gKlxuICogVGhpcyBhbGxvd3MgYXhpb3MgdG8gcnVuIGluIGEgd2ViIHdvcmtlciwgYW5kIHJlYWN0LW5hdGl2ZS5cbiAqIEJvdGggZW52aXJvbm1lbnRzIHN1cHBvcnQgWE1MSHR0cFJlcXVlc3QsIGJ1dCBub3QgZnVsbHkgc3RhbmRhcmQgZ2xvYmFscy5cbiAqXG4gKiB3ZWIgd29ya2VyczpcbiAqICB0eXBlb2Ygd2luZG93IC0+IHVuZGVmaW5lZFxuICogIHR5cGVvZiBkb2N1bWVudCAtPiB1bmRlZmluZWRcbiAqXG4gKiByZWFjdC1uYXRpdmU6XG4gKiAgdHlwZW9mIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQgLT4gdW5kZWZpbmVkXG4gKi9cbmZ1bmN0aW9uIGlzU3RhbmRhcmRCcm93c2VyRW52KCkge1xuICByZXR1cm4gKFxuICAgIHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnICYmXG4gICAgdHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgIHR5cGVvZiBkb2N1bWVudC5jcmVhdGVFbGVtZW50ID09PSAnZnVuY3Rpb24nXG4gICk7XG59XG5cbi8qKlxuICogSXRlcmF0ZSBvdmVyIGFuIEFycmF5IG9yIGFuIE9iamVjdCBpbnZva2luZyBhIGZ1bmN0aW9uIGZvciBlYWNoIGl0ZW0uXG4gKlxuICogSWYgYG9iamAgaXMgYW4gQXJyYXkgY2FsbGJhY2sgd2lsbCBiZSBjYWxsZWQgcGFzc2luZ1xuICogdGhlIHZhbHVlLCBpbmRleCwgYW5kIGNvbXBsZXRlIGFycmF5IGZvciBlYWNoIGl0ZW0uXG4gKlxuICogSWYgJ29iaicgaXMgYW4gT2JqZWN0IGNhbGxiYWNrIHdpbGwgYmUgY2FsbGVkIHBhc3NpbmdcbiAqIHRoZSB2YWx1ZSwga2V5LCBhbmQgY29tcGxldGUgb2JqZWN0IGZvciBlYWNoIHByb3BlcnR5LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fEFycmF5fSBvYmogVGhlIG9iamVjdCB0byBpdGVyYXRlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBUaGUgY2FsbGJhY2sgdG8gaW52b2tlIGZvciBlYWNoIGl0ZW1cbiAqL1xuZnVuY3Rpb24gZm9yRWFjaChvYmosIGZuKSB7XG4gIC8vIERvbid0IGJvdGhlciBpZiBubyB2YWx1ZSBwcm92aWRlZFxuICBpZiAob2JqID09PSBudWxsIHx8IHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gRm9yY2UgYW4gYXJyYXkgaWYgbm90IGFscmVhZHkgc29tZXRoaW5nIGl0ZXJhYmxlXG4gIGlmICh0eXBlb2Ygb2JqICE9PSAnb2JqZWN0JyAmJiAhaXNBcnJheShvYmopKSB7XG4gICAgLyplc2xpbnQgbm8tcGFyYW0tcmVhc3NpZ246MCovXG4gICAgb2JqID0gW29ial07XG4gIH1cblxuICBpZiAoaXNBcnJheShvYmopKSB7XG4gICAgLy8gSXRlcmF0ZSBvdmVyIGFycmF5IHZhbHVlc1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gb2JqLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgZm4uY2FsbChudWxsLCBvYmpbaV0sIGksIG9iaik7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIC8vIEl0ZXJhdGUgb3ZlciBvYmplY3Qga2V5c1xuICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgIGlmIChvYmouaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgICAgICBmbi5jYWxsKG51bGwsIG9ialtrZXldLCBrZXksIG9iaik7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQWNjZXB0cyB2YXJhcmdzIGV4cGVjdGluZyBlYWNoIGFyZ3VtZW50IHRvIGJlIGFuIG9iamVjdCwgdGhlblxuICogaW1tdXRhYmx5IG1lcmdlcyB0aGUgcHJvcGVydGllcyBvZiBlYWNoIG9iamVjdCBhbmQgcmV0dXJucyByZXN1bHQuXG4gKlxuICogV2hlbiBtdWx0aXBsZSBvYmplY3RzIGNvbnRhaW4gdGhlIHNhbWUga2V5IHRoZSBsYXRlciBvYmplY3QgaW5cbiAqIHRoZSBhcmd1bWVudHMgbGlzdCB3aWxsIHRha2UgcHJlY2VkZW5jZS5cbiAqXG4gKiBFeGFtcGxlOlxuICpcbiAqIGBgYGpzXG4gKiB2YXIgcmVzdWx0ID0gbWVyZ2Uoe2ZvbzogMTIzfSwge2ZvbzogNDU2fSk7XG4gKiBjb25zb2xlLmxvZyhyZXN1bHQuZm9vKTsgLy8gb3V0cHV0cyA0NTZcbiAqIGBgYFxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmoxIE9iamVjdCB0byBtZXJnZVxuICogQHJldHVybnMge09iamVjdH0gUmVzdWx0IG9mIGFsbCBtZXJnZSBwcm9wZXJ0aWVzXG4gKi9cbmZ1bmN0aW9uIG1lcmdlKC8qIG9iajEsIG9iajIsIG9iajMsIC4uLiAqLykge1xuICB2YXIgcmVzdWx0ID0ge307XG4gIGZ1bmN0aW9uIGFzc2lnblZhbHVlKHZhbCwga2V5KSB7XG4gICAgaWYgKHR5cGVvZiByZXN1bHRba2V5XSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIHZhbCA9PT0gJ29iamVjdCcpIHtcbiAgICAgIHJlc3VsdFtrZXldID0gbWVyZ2UocmVzdWx0W2tleV0sIHZhbCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdFtrZXldID0gdmFsO1xuICAgIH1cbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwLCBsID0gYXJndW1lbnRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGZvckVhY2goYXJndW1lbnRzW2ldLCBhc3NpZ25WYWx1ZSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGlzQXJyYXk6IGlzQXJyYXksXG4gIGlzQXJyYXlCdWZmZXI6IGlzQXJyYXlCdWZmZXIsXG4gIGlzRm9ybURhdGE6IGlzRm9ybURhdGEsXG4gIGlzQXJyYXlCdWZmZXJWaWV3OiBpc0FycmF5QnVmZmVyVmlldyxcbiAgaXNTdHJpbmc6IGlzU3RyaW5nLFxuICBpc051bWJlcjogaXNOdW1iZXIsXG4gIGlzT2JqZWN0OiBpc09iamVjdCxcbiAgaXNVbmRlZmluZWQ6IGlzVW5kZWZpbmVkLFxuICBpc0RhdGU6IGlzRGF0ZSxcbiAgaXNGaWxlOiBpc0ZpbGUsXG4gIGlzQmxvYjogaXNCbG9iLFxuICBpc1N0YW5kYXJkQnJvd3NlckVudjogaXNTdGFuZGFyZEJyb3dzZXJFbnYsXG4gIGZvckVhY2g6IGZvckVhY2gsXG4gIG1lcmdlOiBtZXJnZSxcbiAgdHJpbTogdHJpbVxufTtcbiIsIjsoZnVuY3Rpb24gKGV4cG9ydHMpIHtcbiAgJ3VzZSBzdHJpY3QnXG5cbiAgdmFyIGxvb2t1cCA9ICdBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWmFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MDEyMzQ1Njc4OSsvJ1xuXG4gIHZhciBBcnIgPSAodHlwZW9mIFVpbnQ4QXJyYXkgIT09ICd1bmRlZmluZWQnKVxuICAgID8gVWludDhBcnJheVxuICAgIDogQXJyYXlcblxuICB2YXIgUExVUyA9ICcrJy5jaGFyQ29kZUF0KDApXG4gIHZhciBTTEFTSCA9ICcvJy5jaGFyQ29kZUF0KDApXG4gIHZhciBOVU1CRVIgPSAnMCcuY2hhckNvZGVBdCgwKVxuICB2YXIgTE9XRVIgPSAnYScuY2hhckNvZGVBdCgwKVxuICB2YXIgVVBQRVIgPSAnQScuY2hhckNvZGVBdCgwKVxuICB2YXIgUExVU19VUkxfU0FGRSA9ICctJy5jaGFyQ29kZUF0KDApXG4gIHZhciBTTEFTSF9VUkxfU0FGRSA9ICdfJy5jaGFyQ29kZUF0KDApXG5cbiAgZnVuY3Rpb24gZGVjb2RlIChlbHQpIHtcbiAgICB2YXIgY29kZSA9IGVsdC5jaGFyQ29kZUF0KDApXG4gICAgaWYgKGNvZGUgPT09IFBMVVMgfHwgY29kZSA9PT0gUExVU19VUkxfU0FGRSkgcmV0dXJuIDYyIC8vICcrJ1xuICAgIGlmIChjb2RlID09PSBTTEFTSCB8fCBjb2RlID09PSBTTEFTSF9VUkxfU0FGRSkgcmV0dXJuIDYzIC8vICcvJ1xuICAgIGlmIChjb2RlIDwgTlVNQkVSKSByZXR1cm4gLTEgLy8gbm8gbWF0Y2hcbiAgICBpZiAoY29kZSA8IE5VTUJFUiArIDEwKSByZXR1cm4gY29kZSAtIE5VTUJFUiArIDI2ICsgMjZcbiAgICBpZiAoY29kZSA8IFVQUEVSICsgMjYpIHJldHVybiBjb2RlIC0gVVBQRVJcbiAgICBpZiAoY29kZSA8IExPV0VSICsgMjYpIHJldHVybiBjb2RlIC0gTE9XRVIgKyAyNlxuICB9XG5cbiAgZnVuY3Rpb24gYjY0VG9CeXRlQXJyYXkgKGI2NCkge1xuICAgIHZhciBpLCBqLCBsLCB0bXAsIHBsYWNlSG9sZGVycywgYXJyXG5cbiAgICBpZiAoYjY0Lmxlbmd0aCAlIDQgPiAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgc3RyaW5nLiBMZW5ndGggbXVzdCBiZSBhIG11bHRpcGxlIG9mIDQnKVxuICAgIH1cblxuICAgIC8vIHRoZSBudW1iZXIgb2YgZXF1YWwgc2lnbnMgKHBsYWNlIGhvbGRlcnMpXG4gICAgLy8gaWYgdGhlcmUgYXJlIHR3byBwbGFjZWhvbGRlcnMsIHRoYW4gdGhlIHR3byBjaGFyYWN0ZXJzIGJlZm9yZSBpdFxuICAgIC8vIHJlcHJlc2VudCBvbmUgYnl0ZVxuICAgIC8vIGlmIHRoZXJlIGlzIG9ubHkgb25lLCB0aGVuIHRoZSB0aHJlZSBjaGFyYWN0ZXJzIGJlZm9yZSBpdCByZXByZXNlbnQgMiBieXRlc1xuICAgIC8vIHRoaXMgaXMganVzdCBhIGNoZWFwIGhhY2sgdG8gbm90IGRvIGluZGV4T2YgdHdpY2VcbiAgICB2YXIgbGVuID0gYjY0Lmxlbmd0aFxuICAgIHBsYWNlSG9sZGVycyA9IGI2NC5jaGFyQXQobGVuIC0gMikgPT09ICc9JyA/IDIgOiBiNjQuY2hhckF0KGxlbiAtIDEpID09PSAnPScgPyAxIDogMFxuXG4gICAgLy8gYmFzZTY0IGlzIDQvMyArIHVwIHRvIHR3byBjaGFyYWN0ZXJzIG9mIHRoZSBvcmlnaW5hbCBkYXRhXG4gICAgYXJyID0gbmV3IEFycihiNjQubGVuZ3RoICogMyAvIDQgLSBwbGFjZUhvbGRlcnMpXG5cbiAgICAvLyBpZiB0aGVyZSBhcmUgcGxhY2Vob2xkZXJzLCBvbmx5IGdldCB1cCB0byB0aGUgbGFzdCBjb21wbGV0ZSA0IGNoYXJzXG4gICAgbCA9IHBsYWNlSG9sZGVycyA+IDAgPyBiNjQubGVuZ3RoIC0gNCA6IGI2NC5sZW5ndGhcblxuICAgIHZhciBMID0gMFxuXG4gICAgZnVuY3Rpb24gcHVzaCAodikge1xuICAgICAgYXJyW0wrK10gPSB2XG4gICAgfVxuXG4gICAgZm9yIChpID0gMCwgaiA9IDA7IGkgPCBsOyBpICs9IDQsIGogKz0gMykge1xuICAgICAgdG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxOCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCAxMikgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDIpKSA8PCA2KSB8IGRlY29kZShiNjQuY2hhckF0KGkgKyAzKSlcbiAgICAgIHB1c2goKHRtcCAmIDB4RkYwMDAwKSA+PiAxNilcbiAgICAgIHB1c2goKHRtcCAmIDB4RkYwMCkgPj4gOClcbiAgICAgIHB1c2godG1wICYgMHhGRilcbiAgICB9XG5cbiAgICBpZiAocGxhY2VIb2xkZXJzID09PSAyKSB7XG4gICAgICB0bXAgPSAoZGVjb2RlKGI2NC5jaGFyQXQoaSkpIDw8IDIpIHwgKGRlY29kZShiNjQuY2hhckF0KGkgKyAxKSkgPj4gNClcbiAgICAgIHB1c2godG1wICYgMHhGRilcbiAgICB9IGVsc2UgaWYgKHBsYWNlSG9sZGVycyA9PT0gMSkge1xuICAgICAgdG1wID0gKGRlY29kZShiNjQuY2hhckF0KGkpKSA8PCAxMCkgfCAoZGVjb2RlKGI2NC5jaGFyQXQoaSArIDEpKSA8PCA0KSB8IChkZWNvZGUoYjY0LmNoYXJBdChpICsgMikpID4+IDIpXG4gICAgICBwdXNoKCh0bXAgPj4gOCkgJiAweEZGKVxuICAgICAgcHVzaCh0bXAgJiAweEZGKVxuICAgIH1cblxuICAgIHJldHVybiBhcnJcbiAgfVxuXG4gIGZ1bmN0aW9uIHVpbnQ4VG9CYXNlNjQgKHVpbnQ4KSB7XG4gICAgdmFyIGlcbiAgICB2YXIgZXh0cmFCeXRlcyA9IHVpbnQ4Lmxlbmd0aCAlIDMgLy8gaWYgd2UgaGF2ZSAxIGJ5dGUgbGVmdCwgcGFkIDIgYnl0ZXNcbiAgICB2YXIgb3V0cHV0ID0gJydcbiAgICB2YXIgdGVtcCwgbGVuZ3RoXG5cbiAgICBmdW5jdGlvbiBlbmNvZGUgKG51bSkge1xuICAgICAgcmV0dXJuIGxvb2t1cC5jaGFyQXQobnVtKVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRyaXBsZXRUb0Jhc2U2NCAobnVtKSB7XG4gICAgICByZXR1cm4gZW5jb2RlKG51bSA+PiAxOCAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiAxMiAmIDB4M0YpICsgZW5jb2RlKG51bSA+PiA2ICYgMHgzRikgKyBlbmNvZGUobnVtICYgMHgzRilcbiAgICB9XG5cbiAgICAvLyBnbyB0aHJvdWdoIHRoZSBhcnJheSBldmVyeSB0aHJlZSBieXRlcywgd2UnbGwgZGVhbCB3aXRoIHRyYWlsaW5nIHN0dWZmIGxhdGVyXG4gICAgZm9yIChpID0gMCwgbGVuZ3RoID0gdWludDgubGVuZ3RoIC0gZXh0cmFCeXRlczsgaSA8IGxlbmd0aDsgaSArPSAzKSB7XG4gICAgICB0ZW1wID0gKHVpbnQ4W2ldIDw8IDE2KSArICh1aW50OFtpICsgMV0gPDwgOCkgKyAodWludDhbaSArIDJdKVxuICAgICAgb3V0cHV0ICs9IHRyaXBsZXRUb0Jhc2U2NCh0ZW1wKVxuICAgIH1cblxuICAgIC8vIHBhZCB0aGUgZW5kIHdpdGggemVyb3MsIGJ1dCBtYWtlIHN1cmUgdG8gbm90IGZvcmdldCB0aGUgZXh0cmEgYnl0ZXNcbiAgICBzd2l0Y2ggKGV4dHJhQnl0ZXMpIHtcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgdGVtcCA9IHVpbnQ4W3VpbnQ4Lmxlbmd0aCAtIDFdXG4gICAgICAgIG91dHB1dCArPSBlbmNvZGUodGVtcCA+PiAyKVxuICAgICAgICBvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wIDw8IDQpICYgMHgzRilcbiAgICAgICAgb3V0cHV0ICs9ICc9PSdcbiAgICAgICAgYnJlYWtcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgdGVtcCA9ICh1aW50OFt1aW50OC5sZW5ndGggLSAyXSA8PCA4KSArICh1aW50OFt1aW50OC5sZW5ndGggLSAxXSlcbiAgICAgICAgb3V0cHV0ICs9IGVuY29kZSh0ZW1wID4+IDEwKVxuICAgICAgICBvdXRwdXQgKz0gZW5jb2RlKCh0ZW1wID4+IDQpICYgMHgzRilcbiAgICAgICAgb3V0cHV0ICs9IGVuY29kZSgodGVtcCA8PCAyKSAmIDB4M0YpXG4gICAgICAgIG91dHB1dCArPSAnPSdcbiAgICAgICAgYnJlYWtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgcmV0dXJuIG91dHB1dFxuICB9XG5cbiAgZXhwb3J0cy50b0J5dGVBcnJheSA9IGI2NFRvQnl0ZUFycmF5XG4gIGV4cG9ydHMuZnJvbUJ5dGVBcnJheSA9IHVpbnQ4VG9CYXNlNjRcbn0odHlwZW9mIGV4cG9ydHMgPT09ICd1bmRlZmluZWQnID8gKHRoaXMuYmFzZTY0anMgPSB7fSkgOiBleHBvcnRzKSlcbiIsIi8qIVxuICogVGhlIGJ1ZmZlciBtb2R1bGUgZnJvbSBub2RlLmpzLCBmb3IgdGhlIGJyb3dzZXIuXG4gKlxuICogQGF1dGhvciAgIEZlcm9zcyBBYm91a2hhZGlqZWggPGZlcm9zc0BmZXJvc3Mub3JnPiA8aHR0cDovL2Zlcm9zcy5vcmc+XG4gKiBAbGljZW5zZSAgTUlUXG4gKi9cbi8qIGVzbGludC1kaXNhYmxlIG5vLXByb3RvICovXG5cbid1c2Ugc3RyaWN0J1xuXG52YXIgYmFzZTY0ID0gcmVxdWlyZSgnYmFzZTY0LWpzJylcbnZhciBpZWVlNzU0ID0gcmVxdWlyZSgnaWVlZTc1NCcpXG52YXIgaXNBcnJheSA9IHJlcXVpcmUoJ2lzYXJyYXknKVxuXG5leHBvcnRzLkJ1ZmZlciA9IEJ1ZmZlclxuZXhwb3J0cy5TbG93QnVmZmVyID0gU2xvd0J1ZmZlclxuZXhwb3J0cy5JTlNQRUNUX01BWF9CWVRFUyA9IDUwXG5CdWZmZXIucG9vbFNpemUgPSA4MTkyIC8vIG5vdCB1c2VkIGJ5IHRoaXMgaW1wbGVtZW50YXRpb25cblxudmFyIHJvb3RQYXJlbnQgPSB7fVxuXG4vKipcbiAqIElmIGBCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVGA6XG4gKiAgID09PSB0cnVlICAgIFVzZSBVaW50OEFycmF5IGltcGxlbWVudGF0aW9uIChmYXN0ZXN0KVxuICogICA9PT0gZmFsc2UgICBVc2UgT2JqZWN0IGltcGxlbWVudGF0aW9uIChtb3N0IGNvbXBhdGlibGUsIGV2ZW4gSUU2KVxuICpcbiAqIEJyb3dzZXJzIHRoYXQgc3VwcG9ydCB0eXBlZCBhcnJheXMgYXJlIElFIDEwKywgRmlyZWZveCA0KywgQ2hyb21lIDcrLCBTYWZhcmkgNS4xKyxcbiAqIE9wZXJhIDExLjYrLCBpT1MgNC4yKy5cbiAqXG4gKiBEdWUgdG8gdmFyaW91cyBicm93c2VyIGJ1Z3MsIHNvbWV0aW1lcyB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uIHdpbGwgYmUgdXNlZCBldmVuXG4gKiB3aGVuIHRoZSBicm93c2VyIHN1cHBvcnRzIHR5cGVkIGFycmF5cy5cbiAqXG4gKiBOb3RlOlxuICpcbiAqICAgLSBGaXJlZm94IDQtMjkgbGFja3Mgc3VwcG9ydCBmb3IgYWRkaW5nIG5ldyBwcm9wZXJ0aWVzIHRvIGBVaW50OEFycmF5YCBpbnN0YW5jZXMsXG4gKiAgICAgU2VlOiBodHRwczovL2J1Z3ppbGxhLm1vemlsbGEub3JnL3Nob3dfYnVnLmNnaT9pZD02OTU0MzguXG4gKlxuICogICAtIENocm9tZSA5LTEwIGlzIG1pc3NpbmcgdGhlIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24uXG4gKlxuICogICAtIElFMTAgaGFzIGEgYnJva2VuIGBUeXBlZEFycmF5LnByb3RvdHlwZS5zdWJhcnJheWAgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyBhcnJheXMgb2ZcbiAqICAgICBpbmNvcnJlY3QgbGVuZ3RoIGluIHNvbWUgc2l0dWF0aW9ucy5cblxuICogV2UgZGV0ZWN0IHRoZXNlIGJ1Z2d5IGJyb3dzZXJzIGFuZCBzZXQgYEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUYCB0byBgZmFsc2VgIHNvIHRoZXlcbiAqIGdldCB0aGUgT2JqZWN0IGltcGxlbWVudGF0aW9uLCB3aGljaCBpcyBzbG93ZXIgYnV0IGJlaGF2ZXMgY29ycmVjdGx5LlxuICovXG5CdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCA9IGdsb2JhbC5UWVBFRF9BUlJBWV9TVVBQT1JUICE9PSB1bmRlZmluZWRcbiAgPyBnbG9iYWwuVFlQRURfQVJSQVlfU1VQUE9SVFxuICA6IHR5cGVkQXJyYXlTdXBwb3J0KClcblxuZnVuY3Rpb24gdHlwZWRBcnJheVN1cHBvcnQgKCkge1xuICB0cnkge1xuICAgIHZhciBhcnIgPSBuZXcgVWludDhBcnJheSgxKVxuICAgIGFyci5mb28gPSBmdW5jdGlvbiAoKSB7IHJldHVybiA0MiB9XG4gICAgcmV0dXJuIGFyci5mb28oKSA9PT0gNDIgJiYgLy8gdHlwZWQgYXJyYXkgaW5zdGFuY2VzIGNhbiBiZSBhdWdtZW50ZWRcbiAgICAgICAgdHlwZW9mIGFyci5zdWJhcnJheSA9PT0gJ2Z1bmN0aW9uJyAmJiAvLyBjaHJvbWUgOS0xMCBsYWNrIGBzdWJhcnJheWBcbiAgICAgICAgYXJyLnN1YmFycmF5KDEsIDEpLmJ5dGVMZW5ndGggPT09IDAgLy8gaWUxMCBoYXMgYnJva2VuIGBzdWJhcnJheWBcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbmZ1bmN0aW9uIGtNYXhMZW5ndGggKCkge1xuICByZXR1cm4gQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlRcbiAgICA/IDB4N2ZmZmZmZmZcbiAgICA6IDB4M2ZmZmZmZmZcbn1cblxuLyoqXG4gKiBUaGUgQnVmZmVyIGNvbnN0cnVjdG9yIHJldHVybnMgaW5zdGFuY2VzIG9mIGBVaW50OEFycmF5YCB0aGF0IGhhdmUgdGhlaXJcbiAqIHByb3RvdHlwZSBjaGFuZ2VkIHRvIGBCdWZmZXIucHJvdG90eXBlYC4gRnVydGhlcm1vcmUsIGBCdWZmZXJgIGlzIGEgc3ViY2xhc3Mgb2ZcbiAqIGBVaW50OEFycmF5YCwgc28gdGhlIHJldHVybmVkIGluc3RhbmNlcyB3aWxsIGhhdmUgYWxsIHRoZSBub2RlIGBCdWZmZXJgIG1ldGhvZHNcbiAqIGFuZCB0aGUgYFVpbnQ4QXJyYXlgIG1ldGhvZHMuIFNxdWFyZSBicmFja2V0IG5vdGF0aW9uIHdvcmtzIGFzIGV4cGVjdGVkIC0tIGl0XG4gKiByZXR1cm5zIGEgc2luZ2xlIG9jdGV0LlxuICpcbiAqIFRoZSBgVWludDhBcnJheWAgcHJvdG90eXBlIHJlbWFpbnMgdW5tb2RpZmllZC5cbiAqL1xuZnVuY3Rpb24gQnVmZmVyIChhcmcpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIEJ1ZmZlcikpIHtcbiAgICAvLyBBdm9pZCBnb2luZyB0aHJvdWdoIGFuIEFyZ3VtZW50c0FkYXB0b3JUcmFtcG9saW5lIGluIHRoZSBjb21tb24gY2FzZS5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHJldHVybiBuZXcgQnVmZmVyKGFyZywgYXJndW1lbnRzWzFdKVxuICAgIHJldHVybiBuZXcgQnVmZmVyKGFyZylcbiAgfVxuXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzLmxlbmd0aCA9IDBcbiAgICB0aGlzLnBhcmVudCA9IHVuZGVmaW5lZFxuICB9XG5cbiAgLy8gQ29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnbnVtYmVyJykge1xuICAgIHJldHVybiBmcm9tTnVtYmVyKHRoaXMsIGFyZylcbiAgfVxuXG4gIC8vIFNsaWdodGx5IGxlc3MgY29tbW9uIGNhc2UuXG4gIGlmICh0eXBlb2YgYXJnID09PSAnc3RyaW5nJykge1xuICAgIHJldHVybiBmcm9tU3RyaW5nKHRoaXMsIGFyZywgYXJndW1lbnRzLmxlbmd0aCA+IDEgPyBhcmd1bWVudHNbMV0gOiAndXRmOCcpXG4gIH1cblxuICAvLyBVbnVzdWFsLlxuICByZXR1cm4gZnJvbU9iamVjdCh0aGlzLCBhcmcpXG59XG5cbi8vIFRPRE86IExlZ2FjeSwgbm90IG5lZWRlZCBhbnltb3JlLiBSZW1vdmUgaW4gbmV4dCBtYWpvciB2ZXJzaW9uLlxuQnVmZmVyLl9hdWdtZW50ID0gZnVuY3Rpb24gKGFycikge1xuICBhcnIuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICByZXR1cm4gYXJyXG59XG5cbmZ1bmN0aW9uIGZyb21OdW1iZXIgKHRoYXQsIGxlbmd0aCkge1xuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoIDwgMCA/IDAgOiBjaGVja2VkKGxlbmd0aCkgfCAwKVxuICBpZiAoIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgdGhhdFtpXSA9IDBcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbVN0cmluZyAodGhhdCwgc3RyaW5nLCBlbmNvZGluZykge1xuICBpZiAodHlwZW9mIGVuY29kaW5nICE9PSAnc3RyaW5nJyB8fCBlbmNvZGluZyA9PT0gJycpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgLy8gQXNzdW1wdGlvbjogYnl0ZUxlbmd0aCgpIHJldHVybiB2YWx1ZSBpcyBhbHdheXMgPCBrTWF4TGVuZ3RoLlxuICB2YXIgbGVuZ3RoID0gYnl0ZUxlbmd0aChzdHJpbmcsIGVuY29kaW5nKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcblxuICB0aGF0LndyaXRlKHN0cmluZywgZW5jb2RpbmcpXG4gIHJldHVybiB0aGF0XG59XG5cbmZ1bmN0aW9uIGZyb21PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICBpZiAoQnVmZmVyLmlzQnVmZmVyKG9iamVjdCkpIHJldHVybiBmcm9tQnVmZmVyKHRoYXQsIG9iamVjdClcblxuICBpZiAoaXNBcnJheShvYmplY3QpKSByZXR1cm4gZnJvbUFycmF5KHRoYXQsIG9iamVjdClcblxuICBpZiAob2JqZWN0ID09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdtdXN0IHN0YXJ0IHdpdGggbnVtYmVyLCBidWZmZXIsIGFycmF5IG9yIHN0cmluZycpXG4gIH1cblxuICBpZiAodHlwZW9mIEFycmF5QnVmZmVyICE9PSAndW5kZWZpbmVkJykge1xuICAgIGlmIChvYmplY3QuYnVmZmVyIGluc3RhbmNlb2YgQXJyYXlCdWZmZXIpIHtcbiAgICAgIHJldHVybiBmcm9tVHlwZWRBcnJheSh0aGF0LCBvYmplY3QpXG4gICAgfVxuICAgIGlmIChvYmplY3QgaW5zdGFuY2VvZiBBcnJheUJ1ZmZlcikge1xuICAgICAgcmV0dXJuIGZyb21BcnJheUJ1ZmZlcih0aGF0LCBvYmplY3QpXG4gICAgfVxuICB9XG5cbiAgaWYgKG9iamVjdC5sZW5ndGgpIHJldHVybiBmcm9tQXJyYXlMaWtlKHRoYXQsIG9iamVjdClcblxuICByZXR1cm4gZnJvbUpzb25PYmplY3QodGhhdCwgb2JqZWN0KVxufVxuXG5mdW5jdGlvbiBmcm9tQnVmZmVyICh0aGF0LCBidWZmZXIpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYnVmZmVyLmxlbmd0aCkgfCAwXG4gIHRoYXQgPSBhbGxvY2F0ZSh0aGF0LCBsZW5ndGgpXG4gIGJ1ZmZlci5jb3B5KHRoYXQsIDAsIDAsIGxlbmd0aClcbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5ICh0aGF0LCBhcnJheSkge1xuICB2YXIgbGVuZ3RoID0gY2hlY2tlZChhcnJheS5sZW5ndGgpIHwgMFxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuLy8gRHVwbGljYXRlIG9mIGZyb21BcnJheSgpIHRvIGtlZXAgZnJvbUFycmF5KCkgbW9ub21vcnBoaWMuXG5mdW5jdGlvbiBmcm9tVHlwZWRBcnJheSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgLy8gVHJ1bmNhdGluZyB0aGUgZWxlbWVudHMgaXMgcHJvYmFibHkgbm90IHdoYXQgcGVvcGxlIGV4cGVjdCBmcm9tIHR5cGVkXG4gIC8vIGFycmF5cyB3aXRoIEJZVEVTX1BFUl9FTEVNRU5UID4gMSBidXQgaXQncyBjb21wYXRpYmxlIHdpdGggdGhlIGJlaGF2aW9yXG4gIC8vIG9mIHRoZSBvbGQgQnVmZmVyIGNvbnN0cnVjdG9yLlxuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSArPSAxKSB7XG4gICAgdGhhdFtpXSA9IGFycmF5W2ldICYgMjU1XG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5QnVmZmVyICh0aGF0LCBhcnJheSkge1xuICBhcnJheS5ieXRlTGVuZ3RoIC8vIHRoaXMgdGhyb3dzIGlmIGBhcnJheWAgaXMgbm90IGEgdmFsaWQgQXJyYXlCdWZmZXJcblxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gbmV3IFVpbnQ4QXJyYXkoYXJyYXkpXG4gICAgdGhhdC5fX3Byb3RvX18gPSBCdWZmZXIucHJvdG90eXBlXG4gIH0gZWxzZSB7XG4gICAgLy8gRmFsbGJhY2s6IFJldHVybiBhbiBvYmplY3QgaW5zdGFuY2Ugb2YgdGhlIEJ1ZmZlciBjbGFzc1xuICAgIHRoYXQgPSBmcm9tVHlwZWRBcnJheSh0aGF0LCBuZXcgVWludDhBcnJheShhcnJheSkpXG4gIH1cbiAgcmV0dXJuIHRoYXRcbn1cblxuZnVuY3Rpb24gZnJvbUFycmF5TGlrZSAodGhhdCwgYXJyYXkpIHtcbiAgdmFyIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgdGhhdCA9IGFsbG9jYXRlKHRoYXQsIGxlbmd0aClcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkgKz0gMSkge1xuICAgIHRoYXRbaV0gPSBhcnJheVtpXSAmIDI1NVxuICB9XG4gIHJldHVybiB0aGF0XG59XG5cbi8vIERlc2VyaWFsaXplIHsgdHlwZTogJ0J1ZmZlcicsIGRhdGE6IFsxLDIsMywuLi5dIH0gaW50byBhIEJ1ZmZlciBvYmplY3QuXG4vLyBSZXR1cm5zIGEgemVyby1sZW5ndGggYnVmZmVyIGZvciBpbnB1dHMgdGhhdCBkb24ndCBjb25mb3JtIHRvIHRoZSBzcGVjLlxuZnVuY3Rpb24gZnJvbUpzb25PYmplY3QgKHRoYXQsIG9iamVjdCkge1xuICB2YXIgYXJyYXlcbiAgdmFyIGxlbmd0aCA9IDBcblxuICBpZiAob2JqZWN0LnR5cGUgPT09ICdCdWZmZXInICYmIGlzQXJyYXkob2JqZWN0LmRhdGEpKSB7XG4gICAgYXJyYXkgPSBvYmplY3QuZGF0YVxuICAgIGxlbmd0aCA9IGNoZWNrZWQoYXJyYXkubGVuZ3RoKSB8IDBcbiAgfVxuICB0aGF0ID0gYWxsb2NhdGUodGhhdCwgbGVuZ3RoKVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEpIHtcbiAgICB0aGF0W2ldID0gYXJyYXlbaV0gJiAyNTVcbiAgfVxuICByZXR1cm4gdGhhdFxufVxuXG5pZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgQnVmZmVyLnByb3RvdHlwZS5fX3Byb3RvX18gPSBVaW50OEFycmF5LnByb3RvdHlwZVxuICBCdWZmZXIuX19wcm90b19fID0gVWludDhBcnJheVxufSBlbHNlIHtcbiAgLy8gcHJlLXNldCBmb3IgdmFsdWVzIHRoYXQgbWF5IGV4aXN0IGluIHRoZSBmdXR1cmVcbiAgQnVmZmVyLnByb3RvdHlwZS5sZW5ndGggPSB1bmRlZmluZWRcbiAgQnVmZmVyLnByb3RvdHlwZS5wYXJlbnQgPSB1bmRlZmluZWRcbn1cblxuZnVuY3Rpb24gYWxsb2NhdGUgKHRoYXQsIGxlbmd0aCkge1xuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICAvLyBSZXR1cm4gYW4gYXVnbWVudGVkIGBVaW50OEFycmF5YCBpbnN0YW5jZSwgZm9yIGJlc3QgcGVyZm9ybWFuY2VcbiAgICB0aGF0ID0gbmV3IFVpbnQ4QXJyYXkobGVuZ3RoKVxuICAgIHRoYXQuX19wcm90b19fID0gQnVmZmVyLnByb3RvdHlwZVxuICB9IGVsc2Uge1xuICAgIC8vIEZhbGxiYWNrOiBSZXR1cm4gYW4gb2JqZWN0IGluc3RhbmNlIG9mIHRoZSBCdWZmZXIgY2xhc3NcbiAgICB0aGF0Lmxlbmd0aCA9IGxlbmd0aFxuICB9XG5cbiAgdmFyIGZyb21Qb29sID0gbGVuZ3RoICE9PSAwICYmIGxlbmd0aCA8PSBCdWZmZXIucG9vbFNpemUgPj4+IDFcbiAgaWYgKGZyb21Qb29sKSB0aGF0LnBhcmVudCA9IHJvb3RQYXJlbnRcblxuICByZXR1cm4gdGhhdFxufVxuXG5mdW5jdGlvbiBjaGVja2VkIChsZW5ndGgpIHtcbiAgLy8gTm90ZTogY2Fubm90IHVzZSBgbGVuZ3RoIDwga01heExlbmd0aGAgaGVyZSBiZWNhdXNlIHRoYXQgZmFpbHMgd2hlblxuICAvLyBsZW5ndGggaXMgTmFOICh3aGljaCBpcyBvdGhlcndpc2UgY29lcmNlZCB0byB6ZXJvLilcbiAgaWYgKGxlbmd0aCA+PSBrTWF4TGVuZ3RoKCkpIHtcbiAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcignQXR0ZW1wdCB0byBhbGxvY2F0ZSBCdWZmZXIgbGFyZ2VyIHRoYW4gbWF4aW11bSAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAnc2l6ZTogMHgnICsga01heExlbmd0aCgpLnRvU3RyaW5nKDE2KSArICcgYnl0ZXMnKVxuICB9XG4gIHJldHVybiBsZW5ndGggfCAwXG59XG5cbmZ1bmN0aW9uIFNsb3dCdWZmZXIgKHN1YmplY3QsIGVuY29kaW5nKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBTbG93QnVmZmVyKSkgcmV0dXJuIG5ldyBTbG93QnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuXG4gIHZhciBidWYgPSBuZXcgQnVmZmVyKHN1YmplY3QsIGVuY29kaW5nKVxuICBkZWxldGUgYnVmLnBhcmVudFxuICByZXR1cm4gYnVmXG59XG5cbkJ1ZmZlci5pc0J1ZmZlciA9IGZ1bmN0aW9uIGlzQnVmZmVyIChiKSB7XG4gIHJldHVybiAhIShiICE9IG51bGwgJiYgYi5faXNCdWZmZXIpXG59XG5cbkJ1ZmZlci5jb21wYXJlID0gZnVuY3Rpb24gY29tcGFyZSAoYSwgYikge1xuICBpZiAoIUJ1ZmZlci5pc0J1ZmZlcihhKSB8fCAhQnVmZmVyLmlzQnVmZmVyKGIpKSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIG11c3QgYmUgQnVmZmVycycpXG4gIH1cblxuICBpZiAoYSA9PT0gYikgcmV0dXJuIDBcblxuICB2YXIgeCA9IGEubGVuZ3RoXG4gIHZhciB5ID0gYi5sZW5ndGhcblxuICB2YXIgaSA9IDBcbiAgdmFyIGxlbiA9IE1hdGgubWluKHgsIHkpXG4gIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgaWYgKGFbaV0gIT09IGJbaV0pIGJyZWFrXG5cbiAgICArK2lcbiAgfVxuXG4gIGlmIChpICE9PSBsZW4pIHtcbiAgICB4ID0gYVtpXVxuICAgIHkgPSBiW2ldXG4gIH1cblxuICBpZiAoeCA8IHkpIHJldHVybiAtMVxuICBpZiAoeSA8IHgpIHJldHVybiAxXG4gIHJldHVybiAwXG59XG5cbkJ1ZmZlci5pc0VuY29kaW5nID0gZnVuY3Rpb24gaXNFbmNvZGluZyAoZW5jb2RpbmcpIHtcbiAgc3dpdGNoIChTdHJpbmcoZW5jb2RpbmcpLnRvTG93ZXJDYXNlKCkpIHtcbiAgICBjYXNlICdoZXgnOlxuICAgIGNhc2UgJ3V0ZjgnOlxuICAgIGNhc2UgJ3V0Zi04JzpcbiAgICBjYXNlICdhc2NpaSc6XG4gICAgY2FzZSAnYmluYXJ5JzpcbiAgICBjYXNlICdiYXNlNjQnOlxuICAgIGNhc2UgJ3Jhdyc6XG4gICAgY2FzZSAndWNzMic6XG4gICAgY2FzZSAndWNzLTInOlxuICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgIHJldHVybiB0cnVlXG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZVxuICB9XG59XG5cbkJ1ZmZlci5jb25jYXQgPSBmdW5jdGlvbiBjb25jYXQgKGxpc3QsIGxlbmd0aCkge1xuICBpZiAoIWlzQXJyYXkobGlzdCkpIHRocm93IG5ldyBUeXBlRXJyb3IoJ2xpc3QgYXJndW1lbnQgbXVzdCBiZSBhbiBBcnJheSBvZiBCdWZmZXJzLicpXG5cbiAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIG5ldyBCdWZmZXIoMClcbiAgfVxuXG4gIHZhciBpXG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCkge1xuICAgIGxlbmd0aCA9IDBcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgbGVuZ3RoICs9IGxpc3RbaV0ubGVuZ3RoXG4gICAgfVxuICB9XG5cbiAgdmFyIGJ1ZiA9IG5ldyBCdWZmZXIobGVuZ3RoKVxuICB2YXIgcG9zID0gMFxuICBmb3IgKGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgIHZhciBpdGVtID0gbGlzdFtpXVxuICAgIGl0ZW0uY29weShidWYsIHBvcylcbiAgICBwb3MgKz0gaXRlbS5sZW5ndGhcbiAgfVxuICByZXR1cm4gYnVmXG59XG5cbmZ1bmN0aW9uIGJ5dGVMZW5ndGggKHN0cmluZywgZW5jb2RpbmcpIHtcbiAgaWYgKHR5cGVvZiBzdHJpbmcgIT09ICdzdHJpbmcnKSBzdHJpbmcgPSAnJyArIHN0cmluZ1xuXG4gIHZhciBsZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChsZW4gPT09IDApIHJldHVybiAwXG5cbiAgLy8gVXNlIGEgZm9yIGxvb3AgdG8gYXZvaWQgcmVjdXJzaW9uXG4gIHZhciBsb3dlcmVkQ2FzZSA9IGZhbHNlXG4gIGZvciAoOzspIHtcbiAgICBzd2l0Y2ggKGVuY29kaW5nKSB7XG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICBjYXNlICdiaW5hcnknOlxuICAgICAgLy8gRGVwcmVjYXRlZFxuICAgICAgY2FzZSAncmF3JzpcbiAgICAgIGNhc2UgJ3Jhd3MnOlxuICAgICAgICByZXR1cm4gbGVuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoXG4gICAgICBjYXNlICd1Y3MyJzpcbiAgICAgIGNhc2UgJ3Vjcy0yJzpcbiAgICAgIGNhc2UgJ3V0ZjE2bGUnOlxuICAgICAgY2FzZSAndXRmLTE2bGUnOlxuICAgICAgICByZXR1cm4gbGVuICogMlxuICAgICAgY2FzZSAnaGV4JzpcbiAgICAgICAgcmV0dXJuIGxlbiA+Pj4gMVxuICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgcmV0dXJuIGJhc2U2NFRvQnl0ZXMoc3RyaW5nKS5sZW5ndGhcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGlmIChsb3dlcmVkQ2FzZSkgcmV0dXJuIHV0ZjhUb0J5dGVzKHN0cmluZykubGVuZ3RoIC8vIGFzc3VtZSB1dGY4XG4gICAgICAgIGVuY29kaW5nID0gKCcnICsgZW5jb2RpbmcpLnRvTG93ZXJDYXNlKClcbiAgICAgICAgbG93ZXJlZENhc2UgPSB0cnVlXG4gICAgfVxuICB9XG59XG5CdWZmZXIuYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGhcblxuZnVuY3Rpb24gc2xvd1RvU3RyaW5nIChlbmNvZGluZywgc3RhcnQsIGVuZCkge1xuICB2YXIgbG93ZXJlZENhc2UgPSBmYWxzZVxuXG4gIHN0YXJ0ID0gc3RhcnQgfCAwXG4gIGVuZCA9IGVuZCA9PT0gdW5kZWZpbmVkIHx8IGVuZCA9PT0gSW5maW5pdHkgPyB0aGlzLmxlbmd0aCA6IGVuZCB8IDBcblxuICBpZiAoIWVuY29kaW5nKSBlbmNvZGluZyA9ICd1dGY4J1xuICBpZiAoc3RhcnQgPCAwKSBzdGFydCA9IDBcbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAoZW5kIDw9IHN0YXJ0KSByZXR1cm4gJydcblxuICB3aGlsZSAodHJ1ZSkge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVNsaWNlKHRoaXMsIHN0YXJ0LCBlbmQpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICByZXR1cm4gYmFzZTY0U2xpY2UodGhpcywgc3RhcnQsIGVuZClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHV0ZjE2bGVTbGljZSh0aGlzLCBzdGFydCwgZW5kKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoZW5jb2RpbmcgKyAnJykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuLy8gVGhlIHByb3BlcnR5IGlzIHVzZWQgYnkgYEJ1ZmZlci5pc0J1ZmZlcmAgYW5kIGBpcy1idWZmZXJgIChpbiBTYWZhcmkgNS03KSB0byBkZXRlY3Rcbi8vIEJ1ZmZlciBpbnN0YW5jZXMuXG5CdWZmZXIucHJvdG90eXBlLl9pc0J1ZmZlciA9IHRydWVcblxuQnVmZmVyLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uIHRvU3RyaW5nICgpIHtcbiAgdmFyIGxlbmd0aCA9IHRoaXMubGVuZ3RoIHwgMFxuICBpZiAobGVuZ3RoID09PSAwKSByZXR1cm4gJydcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHJldHVybiB1dGY4U2xpY2UodGhpcywgMCwgbGVuZ3RoKVxuICByZXR1cm4gc2xvd1RvU3RyaW5nLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5lcXVhbHMgPSBmdW5jdGlvbiBlcXVhbHMgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIHRydWVcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpID09PSAwXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5zcGVjdCA9IGZ1bmN0aW9uIGluc3BlY3QgKCkge1xuICB2YXIgc3RyID0gJydcbiAgdmFyIG1heCA9IGV4cG9ydHMuSU5TUEVDVF9NQVhfQllURVNcbiAgaWYgKHRoaXMubGVuZ3RoID4gMCkge1xuICAgIHN0ciA9IHRoaXMudG9TdHJpbmcoJ2hleCcsIDAsIG1heCkubWF0Y2goLy57Mn0vZykuam9pbignICcpXG4gICAgaWYgKHRoaXMubGVuZ3RoID4gbWF4KSBzdHIgKz0gJyAuLi4gJ1xuICB9XG4gIHJldHVybiAnPEJ1ZmZlciAnICsgc3RyICsgJz4nXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuY29tcGFyZSA9IGZ1bmN0aW9uIGNvbXBhcmUgKGIpIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYikpIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50IG11c3QgYmUgYSBCdWZmZXInKVxuICBpZiAodGhpcyA9PT0gYikgcmV0dXJuIDBcbiAgcmV0dXJuIEJ1ZmZlci5jb21wYXJlKHRoaXMsIGIpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUuaW5kZXhPZiA9IGZ1bmN0aW9uIGluZGV4T2YgKHZhbCwgYnl0ZU9mZnNldCkge1xuICBpZiAoYnl0ZU9mZnNldCA+IDB4N2ZmZmZmZmYpIGJ5dGVPZmZzZXQgPSAweDdmZmZmZmZmXG4gIGVsc2UgaWYgKGJ5dGVPZmZzZXQgPCAtMHg4MDAwMDAwMCkgYnl0ZU9mZnNldCA9IC0weDgwMDAwMDAwXG4gIGJ5dGVPZmZzZXQgPj49IDBcblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVybiAtMVxuICBpZiAoYnl0ZU9mZnNldCA+PSB0aGlzLmxlbmd0aCkgcmV0dXJuIC0xXG5cbiAgLy8gTmVnYXRpdmUgb2Zmc2V0cyBzdGFydCBmcm9tIHRoZSBlbmQgb2YgdGhlIGJ1ZmZlclxuICBpZiAoYnl0ZU9mZnNldCA8IDApIGJ5dGVPZmZzZXQgPSBNYXRoLm1heCh0aGlzLmxlbmd0aCArIGJ5dGVPZmZzZXQsIDApXG5cbiAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgaWYgKHZhbC5sZW5ndGggPT09IDApIHJldHVybiAtMSAvLyBzcGVjaWFsIGNhc2U6IGxvb2tpbmcgZm9yIGVtcHR5IHN0cmluZyBhbHdheXMgZmFpbHNcbiAgICByZXR1cm4gU3RyaW5nLnByb3RvdHlwZS5pbmRleE9mLmNhbGwodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmIChCdWZmZXIuaXNCdWZmZXIodmFsKSkge1xuICAgIHJldHVybiBhcnJheUluZGV4T2YodGhpcywgdmFsLCBieXRlT2Zmc2V0KVxuICB9XG4gIGlmICh0eXBlb2YgdmFsID09PSAnbnVtYmVyJykge1xuICAgIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCAmJiBVaW50OEFycmF5LnByb3RvdHlwZS5pbmRleE9mID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gVWludDhBcnJheS5wcm90b3R5cGUuaW5kZXhPZi5jYWxsKHRoaXMsIHZhbCwgYnl0ZU9mZnNldClcbiAgICB9XG4gICAgcmV0dXJuIGFycmF5SW5kZXhPZih0aGlzLCBbIHZhbCBdLCBieXRlT2Zmc2V0KVxuICB9XG5cbiAgZnVuY3Rpb24gYXJyYXlJbmRleE9mIChhcnIsIHZhbCwgYnl0ZU9mZnNldCkge1xuICAgIHZhciBmb3VuZEluZGV4ID0gLTFcbiAgICBmb3IgKHZhciBpID0gMDsgYnl0ZU9mZnNldCArIGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmIChhcnJbYnl0ZU9mZnNldCArIGldID09PSB2YWxbZm91bmRJbmRleCA9PT0gLTEgPyAwIDogaSAtIGZvdW5kSW5kZXhdKSB7XG4gICAgICAgIGlmIChmb3VuZEluZGV4ID09PSAtMSkgZm91bmRJbmRleCA9IGlcbiAgICAgICAgaWYgKGkgLSBmb3VuZEluZGV4ICsgMSA9PT0gdmFsLmxlbmd0aCkgcmV0dXJuIGJ5dGVPZmZzZXQgKyBmb3VuZEluZGV4XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3VuZEluZGV4ID0gLTFcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIC0xXG4gIH1cblxuICB0aHJvdyBuZXcgVHlwZUVycm9yKCd2YWwgbXVzdCBiZSBzdHJpbmcsIG51bWJlciBvciBCdWZmZXInKVxufVxuXG5mdW5jdGlvbiBoZXhXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIG9mZnNldCA9IE51bWJlcihvZmZzZXQpIHx8IDBcbiAgdmFyIHJlbWFpbmluZyA9IGJ1Zi5sZW5ndGggLSBvZmZzZXRcbiAgaWYgKCFsZW5ndGgpIHtcbiAgICBsZW5ndGggPSByZW1haW5pbmdcbiAgfSBlbHNlIHtcbiAgICBsZW5ndGggPSBOdW1iZXIobGVuZ3RoKVxuICAgIGlmIChsZW5ndGggPiByZW1haW5pbmcpIHtcbiAgICAgIGxlbmd0aCA9IHJlbWFpbmluZ1xuICAgIH1cbiAgfVxuXG4gIC8vIG11c3QgYmUgYW4gZXZlbiBudW1iZXIgb2YgZGlnaXRzXG4gIHZhciBzdHJMZW4gPSBzdHJpbmcubGVuZ3RoXG4gIGlmIChzdHJMZW4gJSAyICE9PSAwKSB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgaGV4IHN0cmluZycpXG5cbiAgaWYgKGxlbmd0aCA+IHN0ckxlbiAvIDIpIHtcbiAgICBsZW5ndGggPSBzdHJMZW4gLyAyXG4gIH1cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgIHZhciBwYXJzZWQgPSBwYXJzZUludChzdHJpbmcuc3Vic3RyKGkgKiAyLCAyKSwgMTYpXG4gICAgaWYgKGlzTmFOKHBhcnNlZCkpIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBoZXggc3RyaW5nJylcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSBwYXJzZWRcbiAgfVxuICByZXR1cm4gaVxufVxuXG5mdW5jdGlvbiB1dGY4V3JpdGUgKGJ1Ziwgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aCkge1xuICByZXR1cm4gYmxpdEJ1ZmZlcih1dGY4VG9CeXRlcyhzdHJpbmcsIGJ1Zi5sZW5ndGggLSBvZmZzZXQpLCBidWYsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBhc2NpaVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIoYXNjaWlUb0J5dGVzKHN0cmluZyksIGJ1Ziwgb2Zmc2V0LCBsZW5ndGgpXG59XG5cbmZ1bmN0aW9uIGJpbmFyeVdyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGFzY2lpV3JpdGUoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxufVxuXG5mdW5jdGlvbiBiYXNlNjRXcml0ZSAoYnVmLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIHJldHVybiBibGl0QnVmZmVyKGJhc2U2NFRvQnl0ZXMoc3RyaW5nKSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuZnVuY3Rpb24gdWNzMldyaXRlIChidWYsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpIHtcbiAgcmV0dXJuIGJsaXRCdWZmZXIodXRmMTZsZVRvQnl0ZXMoc3RyaW5nLCBidWYubGVuZ3RoIC0gb2Zmc2V0KSwgYnVmLCBvZmZzZXQsIGxlbmd0aClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZSA9IGZ1bmN0aW9uIHdyaXRlIChzdHJpbmcsIG9mZnNldCwgbGVuZ3RoLCBlbmNvZGluZykge1xuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nKVxuICBpZiAob2Zmc2V0ID09PSB1bmRlZmluZWQpIHtcbiAgICBlbmNvZGluZyA9ICd1dGY4J1xuICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoXG4gICAgb2Zmc2V0ID0gMFxuICAvLyBCdWZmZXIjd3JpdGUoc3RyaW5nLCBlbmNvZGluZylcbiAgfSBlbHNlIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCAmJiB0eXBlb2Ygb2Zmc2V0ID09PSAnc3RyaW5nJykge1xuICAgIGVuY29kaW5nID0gb2Zmc2V0XG4gICAgbGVuZ3RoID0gdGhpcy5sZW5ndGhcbiAgICBvZmZzZXQgPSAwXG4gIC8vIEJ1ZmZlciN3cml0ZShzdHJpbmcsIG9mZnNldFssIGxlbmd0aF1bLCBlbmNvZGluZ10pXG4gIH0gZWxzZSBpZiAoaXNGaW5pdGUob2Zmc2V0KSkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgICBpZiAoaXNGaW5pdGUobGVuZ3RoKSkge1xuICAgICAgbGVuZ3RoID0gbGVuZ3RoIHwgMFxuICAgICAgaWYgKGVuY29kaW5nID09PSB1bmRlZmluZWQpIGVuY29kaW5nID0gJ3V0ZjgnXG4gICAgfSBlbHNlIHtcbiAgICAgIGVuY29kaW5nID0gbGVuZ3RoXG4gICAgICBsZW5ndGggPSB1bmRlZmluZWRcbiAgICB9XG4gIC8vIGxlZ2FjeSB3cml0ZShzdHJpbmcsIGVuY29kaW5nLCBvZmZzZXQsIGxlbmd0aCkgLSByZW1vdmUgaW4gdjAuMTNcbiAgfSBlbHNlIHtcbiAgICB2YXIgc3dhcCA9IGVuY29kaW5nXG4gICAgZW5jb2RpbmcgPSBvZmZzZXRcbiAgICBvZmZzZXQgPSBsZW5ndGggfCAwXG4gICAgbGVuZ3RoID0gc3dhcFxuICB9XG5cbiAgdmFyIHJlbWFpbmluZyA9IHRoaXMubGVuZ3RoIC0gb2Zmc2V0XG4gIGlmIChsZW5ndGggPT09IHVuZGVmaW5lZCB8fCBsZW5ndGggPiByZW1haW5pbmcpIGxlbmd0aCA9IHJlbWFpbmluZ1xuXG4gIGlmICgoc3RyaW5nLmxlbmd0aCA+IDAgJiYgKGxlbmd0aCA8IDAgfHwgb2Zmc2V0IDwgMCkpIHx8IG9mZnNldCA+IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2F0dGVtcHQgdG8gd3JpdGUgb3V0c2lkZSBidWZmZXIgYm91bmRzJylcbiAgfVxuXG4gIGlmICghZW5jb2RpbmcpIGVuY29kaW5nID0gJ3V0ZjgnXG5cbiAgdmFyIGxvd2VyZWRDYXNlID0gZmFsc2VcbiAgZm9yICg7Oykge1xuICAgIHN3aXRjaCAoZW5jb2RpbmcpIHtcbiAgICAgIGNhc2UgJ2hleCc6XG4gICAgICAgIHJldHVybiBoZXhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICd1dGY4JzpcbiAgICAgIGNhc2UgJ3V0Zi04JzpcbiAgICAgICAgcmV0dXJuIHV0ZjhXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdhc2NpaSc6XG4gICAgICAgIHJldHVybiBhc2NpaVdyaXRlKHRoaXMsIHN0cmluZywgb2Zmc2V0LCBsZW5ndGgpXG5cbiAgICAgIGNhc2UgJ2JpbmFyeSc6XG4gICAgICAgIHJldHVybiBiaW5hcnlXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBjYXNlICdiYXNlNjQnOlxuICAgICAgICAvLyBXYXJuaW5nOiBtYXhMZW5ndGggbm90IHRha2VuIGludG8gYWNjb3VudCBpbiBiYXNlNjRXcml0ZVxuICAgICAgICByZXR1cm4gYmFzZTY0V3JpdGUodGhpcywgc3RyaW5nLCBvZmZzZXQsIGxlbmd0aClcblxuICAgICAgY2FzZSAndWNzMic6XG4gICAgICBjYXNlICd1Y3MtMic6XG4gICAgICBjYXNlICd1dGYxNmxlJzpcbiAgICAgIGNhc2UgJ3V0Zi0xNmxlJzpcbiAgICAgICAgcmV0dXJuIHVjczJXcml0ZSh0aGlzLCBzdHJpbmcsIG9mZnNldCwgbGVuZ3RoKVxuXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBpZiAobG93ZXJlZENhc2UpIHRocm93IG5ldyBUeXBlRXJyb3IoJ1Vua25vd24gZW5jb2Rpbmc6ICcgKyBlbmNvZGluZylcbiAgICAgICAgZW5jb2RpbmcgPSAoJycgKyBlbmNvZGluZykudG9Mb3dlckNhc2UoKVxuICAgICAgICBsb3dlcmVkQ2FzZSA9IHRydWVcbiAgICB9XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS50b0pTT04gPSBmdW5jdGlvbiB0b0pTT04gKCkge1xuICByZXR1cm4ge1xuICAgIHR5cGU6ICdCdWZmZXInLFxuICAgIGRhdGE6IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKHRoaXMuX2FyciB8fCB0aGlzLCAwKVxuICB9XG59XG5cbmZ1bmN0aW9uIGJhc2U2NFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgaWYgKHN0YXJ0ID09PSAwICYmIGVuZCA9PT0gYnVmLmxlbmd0aCkge1xuICAgIHJldHVybiBiYXNlNjQuZnJvbUJ5dGVBcnJheShidWYpXG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGJhc2U2NC5mcm9tQnl0ZUFycmF5KGJ1Zi5zbGljZShzdGFydCwgZW5kKSlcbiAgfVxufVxuXG5mdW5jdGlvbiB1dGY4U2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICBlbmQgPSBNYXRoLm1pbihidWYubGVuZ3RoLCBlbmQpXG4gIHZhciByZXMgPSBbXVxuXG4gIHZhciBpID0gc3RhcnRcbiAgd2hpbGUgKGkgPCBlbmQpIHtcbiAgICB2YXIgZmlyc3RCeXRlID0gYnVmW2ldXG4gICAgdmFyIGNvZGVQb2ludCA9IG51bGxcbiAgICB2YXIgYnl0ZXNQZXJTZXF1ZW5jZSA9IChmaXJzdEJ5dGUgPiAweEVGKSA/IDRcbiAgICAgIDogKGZpcnN0Qnl0ZSA+IDB4REYpID8gM1xuICAgICAgOiAoZmlyc3RCeXRlID4gMHhCRikgPyAyXG4gICAgICA6IDFcblxuICAgIGlmIChpICsgYnl0ZXNQZXJTZXF1ZW5jZSA8PSBlbmQpIHtcbiAgICAgIHZhciBzZWNvbmRCeXRlLCB0aGlyZEJ5dGUsIGZvdXJ0aEJ5dGUsIHRlbXBDb2RlUG9pbnRcblxuICAgICAgc3dpdGNoIChieXRlc1BlclNlcXVlbmNlKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICBpZiAoZmlyc3RCeXRlIDwgMHg4MCkge1xuICAgICAgICAgICAgY29kZVBvaW50ID0gZmlyc3RCeXRlXG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMjpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4MUYpIDw8IDB4NiB8IChzZWNvbmRCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHg3Rikge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBpZiAoKHNlY29uZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAodGhpcmRCeXRlICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICAgIHRlbXBDb2RlUG9pbnQgPSAoZmlyc3RCeXRlICYgMHhGKSA8PCAweEMgfCAoc2Vjb25kQnl0ZSAmIDB4M0YpIDw8IDB4NiB8ICh0aGlyZEJ5dGUgJiAweDNGKVxuICAgICAgICAgICAgaWYgKHRlbXBDb2RlUG9pbnQgPiAweDdGRiAmJiAodGVtcENvZGVQb2ludCA8IDB4RDgwMCB8fCB0ZW1wQ29kZVBvaW50ID4gMHhERkZGKSkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgNDpcbiAgICAgICAgICBzZWNvbmRCeXRlID0gYnVmW2kgKyAxXVxuICAgICAgICAgIHRoaXJkQnl0ZSA9IGJ1ZltpICsgMl1cbiAgICAgICAgICBmb3VydGhCeXRlID0gYnVmW2kgKyAzXVxuICAgICAgICAgIGlmICgoc2Vjb25kQnl0ZSAmIDB4QzApID09PSAweDgwICYmICh0aGlyZEJ5dGUgJiAweEMwKSA9PT0gMHg4MCAmJiAoZm91cnRoQnl0ZSAmIDB4QzApID09PSAweDgwKSB7XG4gICAgICAgICAgICB0ZW1wQ29kZVBvaW50ID0gKGZpcnN0Qnl0ZSAmIDB4RikgPDwgMHgxMiB8IChzZWNvbmRCeXRlICYgMHgzRikgPDwgMHhDIHwgKHRoaXJkQnl0ZSAmIDB4M0YpIDw8IDB4NiB8IChmb3VydGhCeXRlICYgMHgzRilcbiAgICAgICAgICAgIGlmICh0ZW1wQ29kZVBvaW50ID4gMHhGRkZGICYmIHRlbXBDb2RlUG9pbnQgPCAweDExMDAwMCkge1xuICAgICAgICAgICAgICBjb2RlUG9pbnQgPSB0ZW1wQ29kZVBvaW50XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjb2RlUG9pbnQgPT09IG51bGwpIHtcbiAgICAgIC8vIHdlIGRpZCBub3QgZ2VuZXJhdGUgYSB2YWxpZCBjb2RlUG9pbnQgc28gaW5zZXJ0IGFcbiAgICAgIC8vIHJlcGxhY2VtZW50IGNoYXIgKFUrRkZGRCkgYW5kIGFkdmFuY2Ugb25seSAxIGJ5dGVcbiAgICAgIGNvZGVQb2ludCA9IDB4RkZGRFxuICAgICAgYnl0ZXNQZXJTZXF1ZW5jZSA9IDFcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA+IDB4RkZGRikge1xuICAgICAgLy8gZW5jb2RlIHRvIHV0ZjE2IChzdXJyb2dhdGUgcGFpciBkYW5jZSlcbiAgICAgIGNvZGVQb2ludCAtPSAweDEwMDAwXG4gICAgICByZXMucHVzaChjb2RlUG9pbnQgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApXG4gICAgICBjb2RlUG9pbnQgPSAweERDMDAgfCBjb2RlUG9pbnQgJiAweDNGRlxuICAgIH1cblxuICAgIHJlcy5wdXNoKGNvZGVQb2ludClcbiAgICBpICs9IGJ5dGVzUGVyU2VxdWVuY2VcbiAgfVxuXG4gIHJldHVybiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkocmVzKVxufVxuXG4vLyBCYXNlZCBvbiBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yMjc0NzI3Mi82ODA3NDIsIHRoZSBicm93c2VyIHdpdGhcbi8vIHRoZSBsb3dlc3QgbGltaXQgaXMgQ2hyb21lLCB3aXRoIDB4MTAwMDAgYXJncy5cbi8vIFdlIGdvIDEgbWFnbml0dWRlIGxlc3MsIGZvciBzYWZldHlcbnZhciBNQVhfQVJHVU1FTlRTX0xFTkdUSCA9IDB4MTAwMFxuXG5mdW5jdGlvbiBkZWNvZGVDb2RlUG9pbnRzQXJyYXkgKGNvZGVQb2ludHMpIHtcbiAgdmFyIGxlbiA9IGNvZGVQb2ludHMubGVuZ3RoXG4gIGlmIChsZW4gPD0gTUFYX0FSR1VNRU5UU19MRU5HVEgpIHtcbiAgICByZXR1cm4gU3RyaW5nLmZyb21DaGFyQ29kZS5hcHBseShTdHJpbmcsIGNvZGVQb2ludHMpIC8vIGF2b2lkIGV4dHJhIHNsaWNlKClcbiAgfVxuXG4gIC8vIERlY29kZSBpbiBjaHVua3MgdG8gYXZvaWQgXCJjYWxsIHN0YWNrIHNpemUgZXhjZWVkZWRcIi5cbiAgdmFyIHJlcyA9ICcnXG4gIHZhciBpID0gMFxuICB3aGlsZSAoaSA8IGxlbikge1xuICAgIHJlcyArPSBTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KFxuICAgICAgU3RyaW5nLFxuICAgICAgY29kZVBvaW50cy5zbGljZShpLCBpICs9IE1BWF9BUkdVTUVOVFNfTEVOR1RIKVxuICAgIClcbiAgfVxuICByZXR1cm4gcmVzXG59XG5cbmZ1bmN0aW9uIGFzY2lpU2xpY2UgKGJ1Ziwgc3RhcnQsIGVuZCkge1xuICB2YXIgcmV0ID0gJydcbiAgZW5kID0gTWF0aC5taW4oYnVmLmxlbmd0aCwgZW5kKVxuXG4gIGZvciAodmFyIGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgcmV0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnVmW2ldICYgMHg3RilcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGJpbmFyeVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIHJldCA9ICcnXG4gIGVuZCA9IE1hdGgubWluKGJ1Zi5sZW5ndGgsIGVuZClcblxuICBmb3IgKHZhciBpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgIHJldCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGJ1ZltpXSlcbiAgfVxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGhleFNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IGJ1Zi5sZW5ndGhcblxuICBpZiAoIXN0YXJ0IHx8IHN0YXJ0IDwgMCkgc3RhcnQgPSAwXG4gIGlmICghZW5kIHx8IGVuZCA8IDAgfHwgZW5kID4gbGVuKSBlbmQgPSBsZW5cblxuICB2YXIgb3V0ID0gJydcbiAgZm9yICh2YXIgaSA9IHN0YXJ0OyBpIDwgZW5kOyBpKyspIHtcbiAgICBvdXQgKz0gdG9IZXgoYnVmW2ldKVxuICB9XG4gIHJldHVybiBvdXRcbn1cblxuZnVuY3Rpb24gdXRmMTZsZVNsaWNlIChidWYsIHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGJ5dGVzID0gYnVmLnNsaWNlKHN0YXJ0LCBlbmQpXG4gIHZhciByZXMgPSAnJ1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGJ5dGVzLmxlbmd0aDsgaSArPSAyKSB7XG4gICAgcmVzICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoYnl0ZXNbaV0gKyBieXRlc1tpICsgMV0gKiAyNTYpXG4gIH1cbiAgcmV0dXJuIHJlc1xufVxuXG5CdWZmZXIucHJvdG90eXBlLnNsaWNlID0gZnVuY3Rpb24gc2xpY2UgKHN0YXJ0LCBlbmQpIHtcbiAgdmFyIGxlbiA9IHRoaXMubGVuZ3RoXG4gIHN0YXJ0ID0gfn5zdGFydFxuICBlbmQgPSBlbmQgPT09IHVuZGVmaW5lZCA/IGxlbiA6IH5+ZW5kXG5cbiAgaWYgKHN0YXJ0IDwgMCkge1xuICAgIHN0YXJ0ICs9IGxlblxuICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gMFxuICB9IGVsc2UgaWYgKHN0YXJ0ID4gbGVuKSB7XG4gICAgc3RhcnQgPSBsZW5cbiAgfVxuXG4gIGlmIChlbmQgPCAwKSB7XG4gICAgZW5kICs9IGxlblxuICAgIGlmIChlbmQgPCAwKSBlbmQgPSAwXG4gIH0gZWxzZSBpZiAoZW5kID4gbGVuKSB7XG4gICAgZW5kID0gbGVuXG4gIH1cblxuICBpZiAoZW5kIDwgc3RhcnQpIGVuZCA9IHN0YXJ0XG5cbiAgdmFyIG5ld0J1ZlxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICBuZXdCdWYgPSB0aGlzLnN1YmFycmF5KHN0YXJ0LCBlbmQpXG4gICAgbmV3QnVmLl9fcHJvdG9fXyA9IEJ1ZmZlci5wcm90b3R5cGVcbiAgfSBlbHNlIHtcbiAgICB2YXIgc2xpY2VMZW4gPSBlbmQgLSBzdGFydFxuICAgIG5ld0J1ZiA9IG5ldyBCdWZmZXIoc2xpY2VMZW4sIHVuZGVmaW5lZClcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHNsaWNlTGVuOyBpKyspIHtcbiAgICAgIG5ld0J1ZltpXSA9IHRoaXNbaSArIHN0YXJ0XVxuICAgIH1cbiAgfVxuXG4gIGlmIChuZXdCdWYubGVuZ3RoKSBuZXdCdWYucGFyZW50ID0gdGhpcy5wYXJlbnQgfHwgdGhpc1xuXG4gIHJldHVybiBuZXdCdWZcbn1cblxuLypcbiAqIE5lZWQgdG8gbWFrZSBzdXJlIHRoYXQgYnVmZmVyIGlzbid0IHRyeWluZyB0byB3cml0ZSBvdXQgb2YgYm91bmRzLlxuICovXG5mdW5jdGlvbiBjaGVja09mZnNldCAob2Zmc2V0LCBleHQsIGxlbmd0aCkge1xuICBpZiAoKG9mZnNldCAlIDEpICE9PSAwIHx8IG9mZnNldCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdvZmZzZXQgaXMgbm90IHVpbnQnKVxuICBpZiAob2Zmc2V0ICsgZXh0ID4gbGVuZ3RoKSB0aHJvdyBuZXcgUmFuZ2VFcnJvcignVHJ5aW5nIHRvIGFjY2VzcyBiZXlvbmQgYnVmZmVyIGxlbmd0aCcpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRMRSA9IGZ1bmN0aW9uIHJlYWRVSW50TEUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCBieXRlTGVuZ3RoLCB0aGlzLmxlbmd0aClcblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXRdXG4gIHZhciBtdWwgPSAxXG4gIHZhciBpID0gMFxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIGldICogbXVsXG4gIH1cblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnRCRSA9IGZ1bmN0aW9uIHJlYWRVSW50QkUgKG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBieXRlTGVuZ3RoID0gYnl0ZUxlbmd0aCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG4gIH1cblxuICB2YXIgdmFsID0gdGhpc1tvZmZzZXQgKyAtLWJ5dGVMZW5ndGhdXG4gIHZhciBtdWwgPSAxXG4gIHdoaWxlIChieXRlTGVuZ3RoID4gMCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHZhbCArPSB0aGlzW29mZnNldCArIC0tYnl0ZUxlbmd0aF0gKiBtdWxcbiAgfVxuXG4gIHJldHVybiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDggPSBmdW5jdGlvbiByZWFkVUludDggKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAxLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuIHRoaXNbb2Zmc2V0XVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MTZMRSA9IGZ1bmN0aW9uIHJlYWRVSW50MTZMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDIsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gdGhpc1tvZmZzZXRdIHwgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkVUludDE2QkUgPSBmdW5jdGlvbiByZWFkVUludDE2QkUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgcmV0dXJuICh0aGlzW29mZnNldF0gPDwgOCkgfCB0aGlzW29mZnNldCArIDFdXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZFVJbnQzMkxFID0gZnVuY3Rpb24gcmVhZFVJbnQzMkxFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgNCwgdGhpcy5sZW5ndGgpXG5cbiAgcmV0dXJuICgodGhpc1tvZmZzZXRdKSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAxXSA8PCA4KSB8XG4gICAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCAxNikpICtcbiAgICAgICh0aGlzW29mZnNldCArIDNdICogMHgxMDAwMDAwKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRVSW50MzJCRSA9IGZ1bmN0aW9uIHJlYWRVSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdICogMHgxMDAwMDAwKSArXG4gICAgKCh0aGlzW29mZnNldCArIDFdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMl0gPDwgOCkgfFxuICAgIHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludExFID0gZnVuY3Rpb24gcmVhZEludExFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XVxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgd2hpbGUgKCsraSA8IGJ5dGVMZW5ndGggJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB2YWwgKz0gdGhpc1tvZmZzZXQgKyBpXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludEJFID0gZnVuY3Rpb24gcmVhZEludEJFIChvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgYnl0ZUxlbmd0aCwgdGhpcy5sZW5ndGgpXG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoXG4gIHZhciBtdWwgPSAxXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIC0taV1cbiAgd2hpbGUgKGkgPiAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdmFsICs9IHRoaXNbb2Zmc2V0ICsgLS1pXSAqIG11bFxuICB9XG4gIG11bCAqPSAweDgwXG5cbiAgaWYgKHZhbCA+PSBtdWwpIHZhbCAtPSBNYXRoLnBvdygyLCA4ICogYnl0ZUxlbmd0aClcblxuICByZXR1cm4gdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDggPSBmdW5jdGlvbiByZWFkSW50OCAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDEsIHRoaXMubGVuZ3RoKVxuICBpZiAoISh0aGlzW29mZnNldF0gJiAweDgwKSkgcmV0dXJuICh0aGlzW29mZnNldF0pXG4gIHJldHVybiAoKDB4ZmYgLSB0aGlzW29mZnNldF0gKyAxKSAqIC0xKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWRJbnQxNkxFID0gZnVuY3Rpb24gcmVhZEludDE2TEUgKG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tPZmZzZXQob2Zmc2V0LCAyLCB0aGlzLmxlbmd0aClcbiAgdmFyIHZhbCA9IHRoaXNbb2Zmc2V0XSB8ICh0aGlzW29mZnNldCArIDFdIDw8IDgpXG4gIHJldHVybiAodmFsICYgMHg4MDAwKSA/IHZhbCB8IDB4RkZGRjAwMDAgOiB2YWxcbn1cblxuQnVmZmVyLnByb3RvdHlwZS5yZWFkSW50MTZCRSA9IGZ1bmN0aW9uIHJlYWRJbnQxNkJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgMiwgdGhpcy5sZW5ndGgpXG4gIHZhciB2YWwgPSB0aGlzW29mZnNldCArIDFdIHwgKHRoaXNbb2Zmc2V0XSA8PCA4KVxuICByZXR1cm4gKHZhbCAmIDB4ODAwMCkgPyB2YWwgfCAweEZGRkYwMDAwIDogdmFsXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyTEUgPSBmdW5jdGlvbiByZWFkSW50MzJMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdKSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgOCkgfFxuICAgICh0aGlzW29mZnNldCArIDJdIDw8IDE2KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10gPDwgMjQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEludDMyQkUgPSBmdW5jdGlvbiByZWFkSW50MzJCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuXG4gIHJldHVybiAodGhpc1tvZmZzZXRdIDw8IDI0KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgMV0gPDwgMTYpIHxcbiAgICAodGhpc1tvZmZzZXQgKyAyXSA8PCA4KSB8XG4gICAgKHRoaXNbb2Zmc2V0ICsgM10pXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0TEUgPSBmdW5jdGlvbiByZWFkRmxvYXRMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgMjMsIDQpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZEZsb2F0QkUgPSBmdW5jdGlvbiByZWFkRmxvYXRCRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDQsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgZmFsc2UsIDIzLCA0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLnJlYWREb3VibGVMRSA9IGZ1bmN0aW9uIHJlYWREb3VibGVMRSAob2Zmc2V0LCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSBjaGVja09mZnNldChvZmZzZXQsIDgsIHRoaXMubGVuZ3RoKVxuICByZXR1cm4gaWVlZTc1NC5yZWFkKHRoaXMsIG9mZnNldCwgdHJ1ZSwgNTIsIDgpXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUucmVhZERvdWJsZUJFID0gZnVuY3Rpb24gcmVhZERvdWJsZUJFIChvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrT2Zmc2V0KG9mZnNldCwgOCwgdGhpcy5sZW5ndGgpXG4gIHJldHVybiBpZWVlNzU0LnJlYWQodGhpcywgb2Zmc2V0LCBmYWxzZSwgNTIsIDgpXG59XG5cbmZ1bmN0aW9uIGNoZWNrSW50IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKCFCdWZmZXIuaXNCdWZmZXIoYnVmKSkgdGhyb3cgbmV3IFR5cGVFcnJvcignYnVmZmVyIG11c3QgYmUgYSBCdWZmZXIgaW5zdGFuY2UnKVxuICBpZiAodmFsdWUgPiBtYXggfHwgdmFsdWUgPCBtaW4pIHRocm93IG5ldyBSYW5nZUVycm9yKCd2YWx1ZSBpcyBvdXQgb2YgYm91bmRzJylcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludExFID0gZnVuY3Rpb24gd3JpdGVVSW50TEUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgbXVsID0gMVxuICB2YXIgaSA9IDBcbiAgdGhpc1tvZmZzZXRdID0gdmFsdWUgJiAweEZGXG4gIHdoaWxlICgrK2kgPCBieXRlTGVuZ3RoICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludEJFID0gZnVuY3Rpb24gd3JpdGVVSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgYnl0ZUxlbmd0aCA9IGJ5dGVMZW5ndGggfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoKSwgMClcblxuICB2YXIgaSA9IGJ5dGVMZW5ndGggLSAxXG4gIHZhciBtdWwgPSAxXG4gIHRoaXNbb2Zmc2V0ICsgaV0gPSB2YWx1ZSAmIDB4RkZcbiAgd2hpbGUgKC0taSA+PSAwICYmIChtdWwgKj0gMHgxMDApKSB7XG4gICAgdGhpc1tvZmZzZXQgKyBpXSA9ICh2YWx1ZSAvIG11bCkgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlVUludDggPSBmdW5jdGlvbiB3cml0ZVVJbnQ4ICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICB2YWx1ZSA9ICt2YWx1ZVxuICBvZmZzZXQgPSBvZmZzZXQgfCAwXG4gIGlmICghbm9Bc3NlcnQpIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIDEsIDB4ZmYsIDApXG4gIGlmICghQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHZhbHVlID0gTWF0aC5mbG9vcih2YWx1ZSlcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MTYgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmICsgdmFsdWUgKyAxXG4gIGZvciAodmFyIGkgPSAwLCBqID0gTWF0aC5taW4oYnVmLmxlbmd0aCAtIG9mZnNldCwgMik7IGkgPCBqOyBpKyspIHtcbiAgICBidWZbb2Zmc2V0ICsgaV0gPSAodmFsdWUgJiAoMHhmZiA8PCAoOCAqIChsaXR0bGVFbmRpYW4gPyBpIDogMSAtIGkpKSkpID4+PlxuICAgICAgKGxpdHRsZUVuZGlhbiA/IGkgOiAxIC0gaSkgKiA4XG4gIH1cbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQxNkxFID0gZnVuY3Rpb24gd3JpdGVVSW50MTZMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweGZmZmYsIDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSAmIDB4ZmYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlKVxuICB9XG4gIHJldHVybiBvZmZzZXQgKyAyXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlVUludDE2QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHhmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDJcbn1cblxuZnVuY3Rpb24gb2JqZWN0V3JpdGVVSW50MzIgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuKSB7XG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBmb3IgKHZhciBpID0gMCwgaiA9IE1hdGgubWluKGJ1Zi5sZW5ndGggLSBvZmZzZXQsIDQpOyBpIDwgajsgaSsrKSB7XG4gICAgYnVmW29mZnNldCArIGldID0gKHZhbHVlID4+PiAobGl0dGxlRW5kaWFuID8gaSA6IDMgLSBpKSAqIDgpICYgMHhmZlxuICB9XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVVSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlVUludDMyTEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHhmZmZmZmZmZiwgMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSA+Pj4gMjQpXG4gICAgdGhpc1tvZmZzZXQgKyAyXSA9ICh2YWx1ZSA+Pj4gMTYpXG4gICAgdGhpc1tvZmZzZXQgKyAxXSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZVVJbnQzMkJFID0gZnVuY3Rpb24gd3JpdGVVSW50MzJCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweGZmZmZmZmZmLCAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludExFID0gZnVuY3Rpb24gd3JpdGVJbnRMRSAodmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgdmFyIGxpbWl0ID0gTWF0aC5wb3coMiwgOCAqIGJ5dGVMZW5ndGggLSAxKVxuXG4gICAgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgYnl0ZUxlbmd0aCwgbGltaXQgLSAxLCAtbGltaXQpXG4gIH1cblxuICB2YXIgaSA9IDBcbiAgdmFyIG11bCA9IDFcbiAgdmFyIHN1YiA9IHZhbHVlIDwgMCA/IDEgOiAwXG4gIHRoaXNbb2Zmc2V0XSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoKytpIDwgYnl0ZUxlbmd0aCAmJiAobXVsICo9IDB4MTAwKSkge1xuICAgIHRoaXNbb2Zmc2V0ICsgaV0gPSAoKHZhbHVlIC8gbXVsKSA+PiAwKSAtIHN1YiAmIDB4RkZcbiAgfVxuXG4gIHJldHVybiBvZmZzZXQgKyBieXRlTGVuZ3RoXG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVJbnRCRSA9IGZ1bmN0aW9uIHdyaXRlSW50QkUgKHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkge1xuICAgIHZhciBsaW1pdCA9IE1hdGgucG93KDIsIDggKiBieXRlTGVuZ3RoIC0gMSlcblxuICAgIGNoZWNrSW50KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGJ5dGVMZW5ndGgsIGxpbWl0IC0gMSwgLWxpbWl0KVxuICB9XG5cbiAgdmFyIGkgPSBieXRlTGVuZ3RoIC0gMVxuICB2YXIgbXVsID0gMVxuICB2YXIgc3ViID0gdmFsdWUgPCAwID8gMSA6IDBcbiAgdGhpc1tvZmZzZXQgKyBpXSA9IHZhbHVlICYgMHhGRlxuICB3aGlsZSAoLS1pID49IDAgJiYgKG11bCAqPSAweDEwMCkpIHtcbiAgICB0aGlzW29mZnNldCArIGldID0gKCh2YWx1ZSAvIG11bCkgPj4gMCkgLSBzdWIgJiAweEZGXG4gIH1cblxuICByZXR1cm4gb2Zmc2V0ICsgYnl0ZUxlbmd0aFxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50OCA9IGZ1bmN0aW9uIHdyaXRlSW50OCAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAxLCAweDdmLCAtMHg4MClcbiAgaWYgKCFCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkgdmFsdWUgPSBNYXRoLmZsb29yKHZhbHVlKVxuICBpZiAodmFsdWUgPCAwKSB2YWx1ZSA9IDB4ZmYgKyB2YWx1ZSArIDFcbiAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgcmV0dXJuIG9mZnNldCArIDFcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDE2TEUgPSBmdW5jdGlvbiB3cml0ZUludDE2TEUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgMiwgMHg3ZmZmLCAtMHg4MDAwKVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgJiAweGZmKVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDgpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MTYodGhpcywgdmFsdWUsIG9mZnNldCwgdHJ1ZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MTZCRSA9IGZ1bmN0aW9uIHdyaXRlSW50MTZCRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCAyLCAweDdmZmYsIC0weDgwMDApXG4gIGlmIChCdWZmZXIuVFlQRURfQVJSQVlfU1VQUE9SVCkge1xuICAgIHRoaXNbb2Zmc2V0XSA9ICh2YWx1ZSA+Pj4gOClcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlICYgMHhmZilcbiAgfSBlbHNlIHtcbiAgICBvYmplY3RXcml0ZVVJbnQxNih0aGlzLCB2YWx1ZSwgb2Zmc2V0LCBmYWxzZSlcbiAgfVxuICByZXR1cm4gb2Zmc2V0ICsgMlxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlSW50MzJMRSA9IGZ1bmN0aW9uIHdyaXRlSW50MzJMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgdmFsdWUgPSArdmFsdWVcbiAgb2Zmc2V0ID0gb2Zmc2V0IHwgMFxuICBpZiAoIW5vQXNzZXJ0KSBjaGVja0ludCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCA0LCAweDdmZmZmZmZmLCAtMHg4MDAwMDAwMClcbiAgaWYgKEJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgdGhpc1tvZmZzZXRdID0gKHZhbHVlICYgMHhmZilcbiAgICB0aGlzW29mZnNldCArIDFdID0gKHZhbHVlID4+PiA4KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgM10gPSAodmFsdWUgPj4+IDI0KVxuICB9IGVsc2Uge1xuICAgIG9iamVjdFdyaXRlVUludDMyKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUludDMyQkUgPSBmdW5jdGlvbiB3cml0ZUludDMyQkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHZhbHVlID0gK3ZhbHVlXG4gIG9mZnNldCA9IG9mZnNldCB8IDBcbiAgaWYgKCFub0Fzc2VydCkgY2hlY2tJbnQodGhpcywgdmFsdWUsIG9mZnNldCwgNCwgMHg3ZmZmZmZmZiwgLTB4ODAwMDAwMDApXG4gIGlmICh2YWx1ZSA8IDApIHZhbHVlID0gMHhmZmZmZmZmZiArIHZhbHVlICsgMVxuICBpZiAoQnVmZmVyLlRZUEVEX0FSUkFZX1NVUFBPUlQpIHtcbiAgICB0aGlzW29mZnNldF0gPSAodmFsdWUgPj4+IDI0KVxuICAgIHRoaXNbb2Zmc2V0ICsgMV0gPSAodmFsdWUgPj4+IDE2KVxuICAgIHRoaXNbb2Zmc2V0ICsgMl0gPSAodmFsdWUgPj4+IDgpXG4gICAgdGhpc1tvZmZzZXQgKyAzXSA9ICh2YWx1ZSAmIDB4ZmYpXG4gIH0gZWxzZSB7XG4gICAgb2JqZWN0V3JpdGVVSW50MzIodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UpXG4gIH1cbiAgcmV0dXJuIG9mZnNldCArIDRcbn1cblxuZnVuY3Rpb24gY2hlY2tJRUVFNzU0IChidWYsIHZhbHVlLCBvZmZzZXQsIGV4dCwgbWF4LCBtaW4pIHtcbiAgaWYgKG9mZnNldCArIGV4dCA+IGJ1Zi5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdpbmRleCBvdXQgb2YgcmFuZ2UnKVxuICBpZiAob2Zmc2V0IDwgMCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2luZGV4IG91dCBvZiByYW5nZScpXG59XG5cbmZ1bmN0aW9uIHdyaXRlRmxvYXQgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgNCwgMy40MDI4MjM0NjYzODUyODg2ZSszOCwgLTMuNDAyODIzNDY2Mzg1Mjg4NmUrMzgpXG4gIH1cbiAgaWVlZTc1NC53cml0ZShidWYsIHZhbHVlLCBvZmZzZXQsIGxpdHRsZUVuZGlhbiwgMjMsIDQpXG4gIHJldHVybiBvZmZzZXQgKyA0XG59XG5cbkJ1ZmZlci5wcm90b3R5cGUud3JpdGVGbG9hdExFID0gZnVuY3Rpb24gd3JpdGVGbG9hdExFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVGbG9hdCh0aGlzLCB2YWx1ZSwgb2Zmc2V0LCB0cnVlLCBub0Fzc2VydClcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZUZsb2F0QkUgPSBmdW5jdGlvbiB3cml0ZUZsb2F0QkUgKHZhbHVlLCBvZmZzZXQsIG5vQXNzZXJ0KSB7XG4gIHJldHVybiB3cml0ZUZsb2F0KHRoaXMsIHZhbHVlLCBvZmZzZXQsIGZhbHNlLCBub0Fzc2VydClcbn1cblxuZnVuY3Rpb24gd3JpdGVEb3VibGUgKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCBub0Fzc2VydCkge1xuICBpZiAoIW5vQXNzZXJ0KSB7XG4gICAgY2hlY2tJRUVFNzU0KGJ1ZiwgdmFsdWUsIG9mZnNldCwgOCwgMS43OTc2OTMxMzQ4NjIzMTU3RSszMDgsIC0xLjc5NzY5MzEzNDg2MjMxNTdFKzMwOClcbiAgfVxuICBpZWVlNzU0LndyaXRlKGJ1ZiwgdmFsdWUsIG9mZnNldCwgbGl0dGxlRW5kaWFuLCA1MiwgOClcbiAgcmV0dXJuIG9mZnNldCArIDhcbn1cblxuQnVmZmVyLnByb3RvdHlwZS53cml0ZURvdWJsZUxFID0gZnVuY3Rpb24gd3JpdGVEb3VibGVMRSAodmFsdWUsIG9mZnNldCwgbm9Bc3NlcnQpIHtcbiAgcmV0dXJuIHdyaXRlRG91YmxlKHRoaXMsIHZhbHVlLCBvZmZzZXQsIHRydWUsIG5vQXNzZXJ0KVxufVxuXG5CdWZmZXIucHJvdG90eXBlLndyaXRlRG91YmxlQkUgPSBmdW5jdGlvbiB3cml0ZURvdWJsZUJFICh2YWx1ZSwgb2Zmc2V0LCBub0Fzc2VydCkge1xuICByZXR1cm4gd3JpdGVEb3VibGUodGhpcywgdmFsdWUsIG9mZnNldCwgZmFsc2UsIG5vQXNzZXJ0KVxufVxuXG4vLyBjb3B5KHRhcmdldEJ1ZmZlciwgdGFyZ2V0U3RhcnQ9MCwgc291cmNlU3RhcnQ9MCwgc291cmNlRW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmNvcHkgPSBmdW5jdGlvbiBjb3B5ICh0YXJnZXQsIHRhcmdldFN0YXJ0LCBzdGFydCwgZW5kKSB7XG4gIGlmICghc3RhcnQpIHN0YXJ0ID0gMFxuICBpZiAoIWVuZCAmJiBlbmQgIT09IDApIGVuZCA9IHRoaXMubGVuZ3RoXG4gIGlmICh0YXJnZXRTdGFydCA+PSB0YXJnZXQubGVuZ3RoKSB0YXJnZXRTdGFydCA9IHRhcmdldC5sZW5ndGhcbiAgaWYgKCF0YXJnZXRTdGFydCkgdGFyZ2V0U3RhcnQgPSAwXG4gIGlmIChlbmQgPiAwICYmIGVuZCA8IHN0YXJ0KSBlbmQgPSBzdGFydFxuXG4gIC8vIENvcHkgMCBieXRlczsgd2UncmUgZG9uZVxuICBpZiAoZW5kID09PSBzdGFydCkgcmV0dXJuIDBcbiAgaWYgKHRhcmdldC5sZW5ndGggPT09IDAgfHwgdGhpcy5sZW5ndGggPT09IDApIHJldHVybiAwXG5cbiAgLy8gRmF0YWwgZXJyb3IgY29uZGl0aW9uc1xuICBpZiAodGFyZ2V0U3RhcnQgPCAwKSB7XG4gICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ3RhcmdldFN0YXJ0IG91dCBvZiBib3VuZHMnKVxuICB9XG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VTdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDApIHRocm93IG5ldyBSYW5nZUVycm9yKCdzb3VyY2VFbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgLy8gQXJlIHdlIG9vYj9cbiAgaWYgKGVuZCA+IHRoaXMubGVuZ3RoKSBlbmQgPSB0aGlzLmxlbmd0aFxuICBpZiAodGFyZ2V0Lmxlbmd0aCAtIHRhcmdldFN0YXJ0IDwgZW5kIC0gc3RhcnQpIHtcbiAgICBlbmQgPSB0YXJnZXQubGVuZ3RoIC0gdGFyZ2V0U3RhcnQgKyBzdGFydFxuICB9XG5cbiAgdmFyIGxlbiA9IGVuZCAtIHN0YXJ0XG4gIHZhciBpXG5cbiAgaWYgKHRoaXMgPT09IHRhcmdldCAmJiBzdGFydCA8IHRhcmdldFN0YXJ0ICYmIHRhcmdldFN0YXJ0IDwgZW5kKSB7XG4gICAgLy8gZGVzY2VuZGluZyBjb3B5IGZyb20gZW5kXG4gICAgZm9yIChpID0gbGVuIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHRhcmdldFtpICsgdGFyZ2V0U3RhcnRdID0gdGhpc1tpICsgc3RhcnRdXG4gICAgfVxuICB9IGVsc2UgaWYgKGxlbiA8IDEwMDAgfHwgIUJ1ZmZlci5UWVBFRF9BUlJBWV9TVVBQT1JUKSB7XG4gICAgLy8gYXNjZW5kaW5nIGNvcHkgZnJvbSBzdGFydFxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgdGFyZ2V0W2kgKyB0YXJnZXRTdGFydF0gPSB0aGlzW2kgKyBzdGFydF1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgVWludDhBcnJheS5wcm90b3R5cGUuc2V0LmNhbGwoXG4gICAgICB0YXJnZXQsXG4gICAgICB0aGlzLnN1YmFycmF5KHN0YXJ0LCBzdGFydCArIGxlbiksXG4gICAgICB0YXJnZXRTdGFydFxuICAgIClcbiAgfVxuXG4gIHJldHVybiBsZW5cbn1cblxuLy8gZmlsbCh2YWx1ZSwgc3RhcnQ9MCwgZW5kPWJ1ZmZlci5sZW5ndGgpXG5CdWZmZXIucHJvdG90eXBlLmZpbGwgPSBmdW5jdGlvbiBmaWxsICh2YWx1ZSwgc3RhcnQsIGVuZCkge1xuICBpZiAoIXZhbHVlKSB2YWx1ZSA9IDBcbiAgaWYgKCFzdGFydCkgc3RhcnQgPSAwXG4gIGlmICghZW5kKSBlbmQgPSB0aGlzLmxlbmd0aFxuXG4gIGlmIChlbmQgPCBzdGFydCkgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ2VuZCA8IHN0YXJ0JylcblxuICAvLyBGaWxsIDAgYnl0ZXM7IHdlJ3JlIGRvbmVcbiAgaWYgKGVuZCA9PT0gc3RhcnQpIHJldHVyblxuICBpZiAodGhpcy5sZW5ndGggPT09IDApIHJldHVyblxuXG4gIGlmIChzdGFydCA8IDAgfHwgc3RhcnQgPj0gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdzdGFydCBvdXQgb2YgYm91bmRzJylcbiAgaWYgKGVuZCA8IDAgfHwgZW5kID4gdGhpcy5sZW5ndGgpIHRocm93IG5ldyBSYW5nZUVycm9yKCdlbmQgb3V0IG9mIGJvdW5kcycpXG5cbiAgdmFyIGlcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICBmb3IgKGkgPSBzdGFydDsgaSA8IGVuZDsgaSsrKSB7XG4gICAgICB0aGlzW2ldID0gdmFsdWVcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgdmFyIGJ5dGVzID0gdXRmOFRvQnl0ZXModmFsdWUudG9TdHJpbmcoKSlcbiAgICB2YXIgbGVuID0gYnl0ZXMubGVuZ3RoXG4gICAgZm9yIChpID0gc3RhcnQ7IGkgPCBlbmQ7IGkrKykge1xuICAgICAgdGhpc1tpXSA9IGJ5dGVzW2kgJSBsZW5dXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXNcbn1cblxuLy8gSEVMUEVSIEZVTkNUSU9OU1xuLy8gPT09PT09PT09PT09PT09PVxuXG52YXIgSU5WQUxJRF9CQVNFNjRfUkUgPSAvW14rXFwvMC05QS1aYS16LV9dL2dcblxuZnVuY3Rpb24gYmFzZTY0Y2xlYW4gKHN0cikge1xuICAvLyBOb2RlIHN0cmlwcyBvdXQgaW52YWxpZCBjaGFyYWN0ZXJzIGxpa2UgXFxuIGFuZCBcXHQgZnJvbSB0aGUgc3RyaW5nLCBiYXNlNjQtanMgZG9lcyBub3RcbiAgc3RyID0gc3RyaW5ndHJpbShzdHIpLnJlcGxhY2UoSU5WQUxJRF9CQVNFNjRfUkUsICcnKVxuICAvLyBOb2RlIGNvbnZlcnRzIHN0cmluZ3Mgd2l0aCBsZW5ndGggPCAyIHRvICcnXG4gIGlmIChzdHIubGVuZ3RoIDwgMikgcmV0dXJuICcnXG4gIC8vIE5vZGUgYWxsb3dzIGZvciBub24tcGFkZGVkIGJhc2U2NCBzdHJpbmdzIChtaXNzaW5nIHRyYWlsaW5nID09PSksIGJhc2U2NC1qcyBkb2VzIG5vdFxuICB3aGlsZSAoc3RyLmxlbmd0aCAlIDQgIT09IDApIHtcbiAgICBzdHIgPSBzdHIgKyAnPSdcbiAgfVxuICByZXR1cm4gc3RyXG59XG5cbmZ1bmN0aW9uIHN0cmluZ3RyaW0gKHN0cikge1xuICBpZiAoc3RyLnRyaW0pIHJldHVybiBzdHIudHJpbSgpXG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyt8XFxzKyQvZywgJycpXG59XG5cbmZ1bmN0aW9uIHRvSGV4IChuKSB7XG4gIGlmIChuIDwgMTYpIHJldHVybiAnMCcgKyBuLnRvU3RyaW5nKDE2KVxuICByZXR1cm4gbi50b1N0cmluZygxNilcbn1cblxuZnVuY3Rpb24gdXRmOFRvQnl0ZXMgKHN0cmluZywgdW5pdHMpIHtcbiAgdW5pdHMgPSB1bml0cyB8fCBJbmZpbml0eVxuICB2YXIgY29kZVBvaW50XG4gIHZhciBsZW5ndGggPSBzdHJpbmcubGVuZ3RoXG4gIHZhciBsZWFkU3Vycm9nYXRlID0gbnVsbFxuICB2YXIgYnl0ZXMgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBjb2RlUG9pbnQgPSBzdHJpbmcuY2hhckNvZGVBdChpKVxuXG4gICAgLy8gaXMgc3Vycm9nYXRlIGNvbXBvbmVudFxuICAgIGlmIChjb2RlUG9pbnQgPiAweEQ3RkYgJiYgY29kZVBvaW50IDwgMHhFMDAwKSB7XG4gICAgICAvLyBsYXN0IGNoYXIgd2FzIGEgbGVhZFxuICAgICAgaWYgKCFsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAgIC8vIG5vIGxlYWQgeWV0XG4gICAgICAgIGlmIChjb2RlUG9pbnQgPiAweERCRkYpIHtcbiAgICAgICAgICAvLyB1bmV4cGVjdGVkIHRyYWlsXG4gICAgICAgICAgaWYgKCh1bml0cyAtPSAzKSA+IC0xKSBieXRlcy5wdXNoKDB4RUYsIDB4QkYsIDB4QkQpXG4gICAgICAgICAgY29udGludWVcbiAgICAgICAgfSBlbHNlIGlmIChpICsgMSA9PT0gbGVuZ3RoKSB7XG4gICAgICAgICAgLy8gdW5wYWlyZWQgbGVhZFxuICAgICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgIH1cblxuICAgICAgICAvLyB2YWxpZCBsZWFkXG4gICAgICAgIGxlYWRTdXJyb2dhdGUgPSBjb2RlUG9pbnRcblxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICAvLyAyIGxlYWRzIGluIGEgcm93XG4gICAgICBpZiAoY29kZVBvaW50IDwgMHhEQzAwKSB7XG4gICAgICAgIGlmICgodW5pdHMgLT0gMykgPiAtMSkgYnl0ZXMucHVzaCgweEVGLCAweEJGLCAweEJEKVxuICAgICAgICBsZWFkU3Vycm9nYXRlID0gY29kZVBvaW50XG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIC8vIHZhbGlkIHN1cnJvZ2F0ZSBwYWlyXG4gICAgICBjb2RlUG9pbnQgPSAobGVhZFN1cnJvZ2F0ZSAtIDB4RDgwMCA8PCAxMCB8IGNvZGVQb2ludCAtIDB4REMwMCkgKyAweDEwMDAwXG4gICAgfSBlbHNlIGlmIChsZWFkU3Vycm9nYXRlKSB7XG4gICAgICAvLyB2YWxpZCBibXAgY2hhciwgYnV0IGxhc3QgY2hhciB3YXMgYSBsZWFkXG4gICAgICBpZiAoKHVuaXRzIC09IDMpID4gLTEpIGJ5dGVzLnB1c2goMHhFRiwgMHhCRiwgMHhCRClcbiAgICB9XG5cbiAgICBsZWFkU3Vycm9nYXRlID0gbnVsbFxuXG4gICAgLy8gZW5jb2RlIHV0ZjhcbiAgICBpZiAoY29kZVBvaW50IDwgMHg4MCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAxKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKGNvZGVQb2ludClcbiAgICB9IGVsc2UgaWYgKGNvZGVQb2ludCA8IDB4ODAwKSB7XG4gICAgICBpZiAoKHVuaXRzIC09IDIpIDwgMCkgYnJlYWtcbiAgICAgIGJ5dGVzLnB1c2goXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgfCAweEMwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMDAwMCkge1xuICAgICAgaWYgKCh1bml0cyAtPSAzKSA8IDApIGJyZWFrXG4gICAgICBieXRlcy5wdXNoKFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDIHwgMHhFMCxcbiAgICAgICAgY29kZVBvaW50ID4+IDB4NiAmIDB4M0YgfCAweDgwLFxuICAgICAgICBjb2RlUG9pbnQgJiAweDNGIHwgMHg4MFxuICAgICAgKVxuICAgIH0gZWxzZSBpZiAoY29kZVBvaW50IDwgMHgxMTAwMDApIHtcbiAgICAgIGlmICgodW5pdHMgLT0gNCkgPCAwKSBicmVha1xuICAgICAgYnl0ZXMucHVzaChcbiAgICAgICAgY29kZVBvaW50ID4+IDB4MTIgfCAweEYwLFxuICAgICAgICBjb2RlUG9pbnQgPj4gMHhDICYgMHgzRiB8IDB4ODAsXG4gICAgICAgIGNvZGVQb2ludCA+PiAweDYgJiAweDNGIHwgMHg4MCxcbiAgICAgICAgY29kZVBvaW50ICYgMHgzRiB8IDB4ODBcbiAgICAgIClcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvZGUgcG9pbnQnKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBieXRlc1xufVxuXG5mdW5jdGlvbiBhc2NpaVRvQnl0ZXMgKHN0cikge1xuICB2YXIgYnl0ZUFycmF5ID0gW11cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICAvLyBOb2RlJ3MgY29kZSBzZWVtcyB0byBiZSBkb2luZyB0aGlzIGFuZCBub3QgJiAweDdGLi5cbiAgICBieXRlQXJyYXkucHVzaChzdHIuY2hhckNvZGVBdChpKSAmIDB4RkYpXG4gIH1cbiAgcmV0dXJuIGJ5dGVBcnJheVxufVxuXG5mdW5jdGlvbiB1dGYxNmxlVG9CeXRlcyAoc3RyLCB1bml0cykge1xuICB2YXIgYywgaGksIGxvXG4gIHZhciBieXRlQXJyYXkgPSBbXVxuICBmb3IgKHZhciBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGlmICgodW5pdHMgLT0gMikgPCAwKSBicmVha1xuXG4gICAgYyA9IHN0ci5jaGFyQ29kZUF0KGkpXG4gICAgaGkgPSBjID4+IDhcbiAgICBsbyA9IGMgJSAyNTZcbiAgICBieXRlQXJyYXkucHVzaChsbylcbiAgICBieXRlQXJyYXkucHVzaChoaSlcbiAgfVxuXG4gIHJldHVybiBieXRlQXJyYXlcbn1cblxuZnVuY3Rpb24gYmFzZTY0VG9CeXRlcyAoc3RyKSB7XG4gIHJldHVybiBiYXNlNjQudG9CeXRlQXJyYXkoYmFzZTY0Y2xlYW4oc3RyKSlcbn1cblxuZnVuY3Rpb24gYmxpdEJ1ZmZlciAoc3JjLCBkc3QsIG9mZnNldCwgbGVuZ3RoKSB7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoKGkgKyBvZmZzZXQgPj0gZHN0Lmxlbmd0aCkgfHwgKGkgPj0gc3JjLmxlbmd0aCkpIGJyZWFrXG4gICAgZHN0W2kgKyBvZmZzZXRdID0gc3JjW2ldXG4gIH1cbiAgcmV0dXJuIGlcbn1cbiIsInZhciB0b1N0cmluZyA9IHt9LnRvU3RyaW5nO1xuXG5tb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gdG9TdHJpbmcuY2FsbChhcnIpID09ICdbb2JqZWN0IEFycmF5XSc7XG59O1xuIiwiLy8gIENoYW5jZS5qcyAwLjguMFxuLy8gIGh0dHA6Ly9jaGFuY2Vqcy5jb21cbi8vICAoYykgMjAxMyBWaWN0b3IgUXVpbm5cbi8vICBDaGFuY2UgbWF5IGJlIGZyZWVseSBkaXN0cmlidXRlZCBvciBtb2RpZmllZCB1bmRlciB0aGUgTUlUIGxpY2Vuc2UuXG5cbihmdW5jdGlvbiAoKSB7XG5cbiAgICAvLyBDb25zdGFudHNcbiAgICB2YXIgTUFYX0lOVCA9IDkwMDcxOTkyNTQ3NDA5OTI7XG4gICAgdmFyIE1JTl9JTlQgPSAtTUFYX0lOVDtcbiAgICB2YXIgTlVNQkVSUyA9ICcwMTIzNDU2Nzg5JztcbiAgICB2YXIgQ0hBUlNfTE9XRVIgPSAnYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXonO1xuICAgIHZhciBDSEFSU19VUFBFUiA9IENIQVJTX0xPV0VSLnRvVXBwZXJDYXNlKCk7XG4gICAgdmFyIEhFWF9QT09MICA9IE5VTUJFUlMgKyBcImFiY2RlZlwiO1xuXG4gICAgLy8gQ2FjaGVkIGFycmF5IGhlbHBlcnNcbiAgICB2YXIgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2U7XG5cbiAgICAvLyBDb25zdHJ1Y3RvclxuICAgIGZ1bmN0aW9uIENoYW5jZSAoc2VlZCkge1xuICAgICAgICBpZiAoISh0aGlzIGluc3RhbmNlb2YgQ2hhbmNlKSkge1xuICAgICAgICAgICAgcmV0dXJuIHNlZWQgPT0gbnVsbCA/IG5ldyBDaGFuY2UoKSA6IG5ldyBDaGFuY2Uoc2VlZCk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiB1c2VyIGhhcyBwcm92aWRlZCBhIGZ1bmN0aW9uLCB1c2UgdGhhdCBhcyB0aGUgZ2VuZXJhdG9yXG4gICAgICAgIGlmICh0eXBlb2Ygc2VlZCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgdGhpcy5yYW5kb20gPSBzZWVkO1xuICAgICAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgICAgICAgLy8gc2V0IGEgc3RhcnRpbmcgdmFsdWUgb2YgemVybyBzbyB3ZSBjYW4gYWRkIHRvIGl0XG4gICAgICAgICAgICB0aGlzLnNlZWQgPSAwO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gb3RoZXJ3aXNlLCBsZWF2ZSB0aGlzLnNlZWQgYmxhbmsgc28gdGhhdCBNVCB3aWxsIHJlY2VpdmUgYSBibGFua1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgc2VlZGxpbmcgPSAwO1xuICAgICAgICAgICAgaWYgKE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhcmd1bWVudHNbaV0pID09PSAnW29iamVjdCBTdHJpbmddJykge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgYXJndW1lbnRzW2ldLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGNyZWF0ZSBhIG51bWVyaWMgaGFzaCBmb3IgZWFjaCBhcmd1bWVudCwgYWRkIHRvIHNlZWRsaW5nXG4gICAgICAgICAgICAgICAgICAgIHZhciBoYXNoID0gMDtcbiAgICAgICAgICAgICAgICAgICAgZm9yICh2YXIgayA9IDA7IGsgPCBhcmd1bWVudHNbaV0ubGVuZ3RoOyBrKyspIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhc2ggPSBhcmd1bWVudHNbaV0uY2hhckNvZGVBdChrKSArIChoYXNoIDw8IDYpICsgKGhhc2ggPDwgMTYpIC0gaGFzaDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBzZWVkbGluZyArPSBoYXNoO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc2VlZGxpbmcgPSBhcmd1bWVudHNbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnNlZWQgKz0gKGFyZ3VtZW50cy5sZW5ndGggLSBpKSAqIHNlZWRsaW5nO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgbm8gZ2VuZXJhdG9yIGZ1bmN0aW9uIHdhcyBwcm92aWRlZCwgdXNlIG91ciBNVFxuICAgICAgICB0aGlzLm10ID0gdGhpcy5tZXJzZW5uZV90d2lzdGVyKHRoaXMuc2VlZCk7XG4gICAgICAgIHRoaXMuYmltZDUgPSB0aGlzLmJsdWVpbXBfbWQ1KCk7XG4gICAgICAgIHRoaXMucmFuZG9tID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubXQucmFuZG9tKHRoaXMuc2VlZCk7XG4gICAgICAgIH07XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5WRVJTSU9OID0gXCIwLjguMFwiO1xuXG4gICAgLy8gUmFuZG9tIGhlbHBlciBmdW5jdGlvbnNcbiAgICBmdW5jdGlvbiBpbml0T3B0aW9ucyhvcHRpb25zLCBkZWZhdWx0cykge1xuICAgICAgICBvcHRpb25zIHx8IChvcHRpb25zID0ge30pO1xuXG4gICAgICAgIGlmIChkZWZhdWx0cykge1xuICAgICAgICAgICAgZm9yICh2YXIgaSBpbiBkZWZhdWx0cykge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2Ygb3B0aW9uc1tpXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uc1tpXSA9IGRlZmF1bHRzW2ldO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvcHRpb25zO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHRlc3RSYW5nZSh0ZXN0LCBlcnJvck1lc3NhZ2UpIHtcbiAgICAgICAgaWYgKHRlc3QpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKGVycm9yTWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFbmNvZGUgdGhlIGlucHV0IHN0cmluZyB3aXRoIEJhc2U2NC5cbiAgICAgKi9cbiAgICB2YXIgYmFzZTY0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTm8gQmFzZTY0IGVuY29kZXIgYXZhaWxhYmxlLicpO1xuICAgIH07XG5cbiAgICAvLyBTZWxlY3QgcHJvcGVyIEJhc2U2NCBlbmNvZGVyLlxuICAgIChmdW5jdGlvbiBkZXRlcm1pbmVCYXNlNjRFbmNvZGVyKCkge1xuICAgICAgICBpZiAodHlwZW9mIGJ0b2EgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGJhc2U2NCA9IGJ0b2E7XG4gICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIEJ1ZmZlciA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgYmFzZTY0ID0gZnVuY3Rpb24oaW5wdXQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbmV3IEJ1ZmZlcihpbnB1dCkudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0pKCk7XG5cbiAgICAvLyAtLSBCYXNpY3MgLS1cblxuICAgIC8qKlxuICAgICAqICBSZXR1cm4gYSByYW5kb20gYm9vbCwgZWl0aGVyIHRydWUgb3IgZmFsc2VcbiAgICAgKlxuICAgICAqICBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9eyBsaWtlbGlob29kOiA1MCB9XSBhbHRlciB0aGUgbGlrZWxpaG9vZCBvZlxuICAgICAqICAgIHJlY2VpdmluZyBhIHRydWUgb3IgZmFsc2UgdmFsdWUgYmFjay5cbiAgICAgKiAgQHRocm93cyB7UmFuZ2VFcnJvcn0gaWYgdGhlIGxpa2VsaWhvb2QgaXMgb3V0IG9mIGJvdW5kc1xuICAgICAqICBAcmV0dXJucyB7Qm9vbH0gZWl0aGVyIHRydWUgb3IgZmFsc2VcbiAgICAgKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLmJvb2wgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICAvLyBsaWtlbGlob29kIG9mIHN1Y2Nlc3MgKHRydWUpXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bGlrZWxpaG9vZCA6IDUwfSk7XG5cbiAgICAgICAgLy8gTm90ZSwgd2UgY291bGQgZ2V0IHNvbWUgbWlub3IgcGVyZiBvcHRpbWl6YXRpb25zIGJ5IGNoZWNraW5nIHJhbmdlXG4gICAgICAgIC8vIHByaW9yIHRvIGluaXRpYWxpemluZyBkZWZhdWx0cywgYnV0IHRoYXQgbWFrZXMgY29kZSBhIGJpdCBtZXNzaWVyXG4gICAgICAgIC8vIGFuZCB0aGUgY2hlY2sgbW9yZSBjb21wbGljYXRlZCBhcyB3ZSBoYXZlIHRvIGNoZWNrIGV4aXN0ZW5jZSBvZlxuICAgICAgICAvLyB0aGUgb2JqZWN0IHRoZW4gZXhpc3RlbmNlIG9mIHRoZSBrZXkgYmVmb3JlIGNoZWNraW5nIGNvbnN0cmFpbnRzLlxuICAgICAgICAvLyBTaW5jZSB0aGUgb3B0aW9ucyBpbml0aWFsaXphdGlvbiBzaG91bGQgYmUgbWlub3IgY29tcHV0YXRpb25hbGx5LFxuICAgICAgICAvLyBkZWNpc2lvbiBtYWRlIGZvciBjb2RlIGNsZWFubGluZXNzIGludGVudGlvbmFsbHkuIFRoaXMgaXMgbWVudGlvbmVkXG4gICAgICAgIC8vIGhlcmUgYXMgaXQncyB0aGUgZmlyc3Qgb2NjdXJyZW5jZSwgd2lsbCBub3QgYmUgbWVudGlvbmVkIGFnYWluLlxuICAgICAgICB0ZXN0UmFuZ2UoXG4gICAgICAgICAgICBvcHRpb25zLmxpa2VsaWhvb2QgPCAwIHx8IG9wdGlvbnMubGlrZWxpaG9vZCA+IDEwMCxcbiAgICAgICAgICAgIFwiQ2hhbmNlOiBMaWtlbGlob29kIGFjY2VwdHMgdmFsdWVzIGZyb20gMCB0byAxMDAuXCJcbiAgICAgICAgKTtcblxuICAgICAgICByZXR1cm4gdGhpcy5yYW5kb20oKSAqIDEwMCA8IG9wdGlvbnMubGlrZWxpaG9vZDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogIFJldHVybiBhIHJhbmRvbSBjaGFyYWN0ZXIuXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zPXt9XSBjYW4gc3BlY2lmeSBhIGNoYXJhY3RlciBwb29sLCBvbmx5IGFscGhhLFxuICAgICAqICAgIG9ubHkgc3ltYm9scywgYW5kIGNhc2luZyAobG93ZXIgb3IgdXBwZXIpXG4gICAgICogIEByZXR1cm5zIHtTdHJpbmd9IGEgc2luZ2xlIHJhbmRvbSBjaGFyYWN0ZXJcbiAgICAgKiAgQHRocm93cyB7UmFuZ2VFcnJvcn0gQ2FuIG9ubHkgc3BlY2lmeSBhbHBoYSBvciBzeW1ib2xzLCBub3QgYm90aFxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUuY2hhcmFjdGVyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICB0ZXN0UmFuZ2UoXG4gICAgICAgICAgICBvcHRpb25zLmFscGhhICYmIG9wdGlvbnMuc3ltYm9scyxcbiAgICAgICAgICAgIFwiQ2hhbmNlOiBDYW5ub3Qgc3BlY2lmeSBib3RoIGFscGhhIGFuZCBzeW1ib2xzLlwiXG4gICAgICAgICk7XG5cbiAgICAgICAgdmFyIHN5bWJvbHMgPSBcIiFAIyQlXiYqKClbXVwiLFxuICAgICAgICAgICAgbGV0dGVycywgcG9vbDtcblxuICAgICAgICBpZiAob3B0aW9ucy5jYXNpbmcgPT09ICdsb3dlcicpIHtcbiAgICAgICAgICAgIGxldHRlcnMgPSBDSEFSU19MT1dFUjtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmNhc2luZyA9PT0gJ3VwcGVyJykge1xuICAgICAgICAgICAgbGV0dGVycyA9IENIQVJTX1VQUEVSO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0dGVycyA9IENIQVJTX0xPV0VSICsgQ0hBUlNfVVBQRVI7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAob3B0aW9ucy5wb29sKSB7XG4gICAgICAgICAgICBwb29sID0gb3B0aW9ucy5wb29sO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuYWxwaGEpIHtcbiAgICAgICAgICAgIHBvb2wgPSBsZXR0ZXJzO1xuICAgICAgICB9IGVsc2UgaWYgKG9wdGlvbnMuc3ltYm9scykge1xuICAgICAgICAgICAgcG9vbCA9IHN5bWJvbHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBwb29sID0gbGV0dGVycyArIE5VTUJFUlMgKyBzeW1ib2xzO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHBvb2wuY2hhckF0KHRoaXMubmF0dXJhbCh7bWF4OiAocG9vbC5sZW5ndGggLSAxKX0pKTtcbiAgICB9O1xuXG4gICAgLy8gTm90ZSwgd2FudGVkIHRvIHVzZSBcImZsb2F0XCIgb3IgXCJkb3VibGVcIiBidXQgdGhvc2UgYXJlIGJvdGggSlMgcmVzZXJ2ZWQgd29yZHMuXG5cbiAgICAvLyBOb3RlLCBmaXhlZCBtZWFucyBOIE9SIExFU1MgZGlnaXRzIGFmdGVyIHRoZSBkZWNpbWFsLiBUaGlzIGJlY2F1c2VcbiAgICAvLyBJdCBjb3VsZCBiZSAxNC45MDAwIGJ1dCBpbiBKYXZhU2NyaXB0LCB3aGVuIHRoaXMgaXMgY2FzdCBhcyBhIG51bWJlcixcbiAgICAvLyB0aGUgdHJhaWxpbmcgemVyb2VzIGFyZSBkcm9wcGVkLiBMZWZ0IHRvIHRoZSBjb25zdW1lciBpZiB0cmFpbGluZyB6ZXJvZXMgYXJlXG4gICAgLy8gbmVlZGVkXG4gICAgLyoqXG4gICAgICogIFJldHVybiBhIHJhbmRvbSBmbG9hdGluZyBwb2ludCBudW1iZXJcbiAgICAgKlxuICAgICAqICBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIGNhbiBzcGVjaWZ5IGEgZml4ZWQgcHJlY2lzaW9uLCBtaW4sIG1heFxuICAgICAqICBAcmV0dXJucyB7TnVtYmVyfSBhIHNpbmdsZSBmbG9hdGluZyBwb2ludCBudW1iZXJcbiAgICAgKiAgQHRocm93cyB7UmFuZ2VFcnJvcn0gQ2FuIG9ubHkgc3BlY2lmeSBmaXhlZCBvciBwcmVjaXNpb24sIG5vdCBib3RoLiBBbHNvXG4gICAgICogICAgbWluIGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gbWF4XG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5mbG9hdGluZyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7Zml4ZWQgOiA0fSk7XG4gICAgICAgIHRlc3RSYW5nZShcbiAgICAgICAgICAgIG9wdGlvbnMuZml4ZWQgJiYgb3B0aW9ucy5wcmVjaXNpb24sXG4gICAgICAgICAgICBcIkNoYW5jZTogQ2Fubm90IHNwZWNpZnkgYm90aCBmaXhlZCBhbmQgcHJlY2lzaW9uLlwiXG4gICAgICAgICk7XG5cbiAgICAgICAgdmFyIG51bTtcbiAgICAgICAgdmFyIGZpeGVkID0gTWF0aC5wb3coMTAsIG9wdGlvbnMuZml4ZWQpO1xuXG4gICAgICAgIHZhciBtYXggPSBNQVhfSU5UIC8gZml4ZWQ7XG4gICAgICAgIHZhciBtaW4gPSAtbWF4O1xuXG4gICAgICAgIHRlc3RSYW5nZShcbiAgICAgICAgICAgIG9wdGlvbnMubWluICYmIG9wdGlvbnMuZml4ZWQgJiYgb3B0aW9ucy5taW4gPCBtaW4sXG4gICAgICAgICAgICBcIkNoYW5jZTogTWluIHNwZWNpZmllZCBpcyBvdXQgb2YgcmFuZ2Ugd2l0aCBmaXhlZC4gTWluIHNob3VsZCBiZSwgYXQgbGVhc3QsIFwiICsgbWluXG4gICAgICAgICk7XG4gICAgICAgIHRlc3RSYW5nZShcbiAgICAgICAgICAgIG9wdGlvbnMubWF4ICYmIG9wdGlvbnMuZml4ZWQgJiYgb3B0aW9ucy5tYXggPiBtYXgsXG4gICAgICAgICAgICBcIkNoYW5jZTogTWF4IHNwZWNpZmllZCBpcyBvdXQgb2YgcmFuZ2Ugd2l0aCBmaXhlZC4gTWF4IHNob3VsZCBiZSwgYXQgbW9zdCwgXCIgKyBtYXhcbiAgICAgICAgKTtcblxuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBtaW4gOiBtaW4sIG1heCA6IG1heCB9KTtcblxuICAgICAgICAvLyBUb2RvIC0gTWFrZSB0aGlzIHdvcmshXG4gICAgICAgIC8vIG9wdGlvbnMucHJlY2lzaW9uID0gKHR5cGVvZiBvcHRpb25zLnByZWNpc2lvbiAhPT0gXCJ1bmRlZmluZWRcIikgPyBvcHRpb25zLnByZWNpc2lvbiA6IGZhbHNlO1xuXG4gICAgICAgIG51bSA9IHRoaXMuaW50ZWdlcih7bWluOiBvcHRpb25zLm1pbiAqIGZpeGVkLCBtYXg6IG9wdGlvbnMubWF4ICogZml4ZWR9KTtcbiAgICAgICAgdmFyIG51bV9maXhlZCA9IChudW0gLyBmaXhlZCkudG9GaXhlZChvcHRpb25zLmZpeGVkKTtcblxuICAgICAgICByZXR1cm4gcGFyc2VGbG9hdChudW1fZml4ZWQpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiAgUmV0dXJuIGEgcmFuZG9tIGludGVnZXJcbiAgICAgKlxuICAgICAqICBOT1RFIHRoZSBtYXggYW5kIG1pbiBhcmUgSU5DTFVERUQgaW4gdGhlIHJhbmdlLiBTbzpcbiAgICAgKiAgY2hhbmNlLmludGVnZXIoe21pbjogMSwgbWF4OiAzfSk7XG4gICAgICogIHdvdWxkIHJldHVybiBlaXRoZXIgMSwgMiwgb3IgMy5cbiAgICAgKlxuICAgICAqICBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIGNhbiBzcGVjaWZ5IGEgbWluIGFuZC9vciBtYXhcbiAgICAgKiAgQHJldHVybnMge051bWJlcn0gYSBzaW5nbGUgcmFuZG9tIGludGVnZXIgbnVtYmVyXG4gICAgICogIEB0aHJvd3Mge1JhbmdlRXJyb3J9IG1pbiBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIG1heFxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUuaW50ZWdlciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIC8vIDkwMDcxOTkyNTQ3NDA5OTIgKDJeNTMpIGlzIHRoZSBtYXggaW50ZWdlciBudW1iZXIgaW4gSmF2YVNjcmlwdFxuICAgICAgICAvLyBTZWU6IGh0dHA6Ly92cS5pby8xMzJzYTJqXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bWluOiBNSU5fSU5ULCBtYXg6IE1BWF9JTlR9KTtcbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWluID4gb3B0aW9ucy5tYXgsIFwiQ2hhbmNlOiBNaW4gY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiBNYXguXCIpO1xuXG4gICAgICAgIHJldHVybiBNYXRoLmZsb29yKHRoaXMucmFuZG9tKCkgKiAob3B0aW9ucy5tYXggLSBvcHRpb25zLm1pbiArIDEpICsgb3B0aW9ucy5taW4pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiAgUmV0dXJuIGEgcmFuZG9tIG5hdHVyYWxcbiAgICAgKlxuICAgICAqICBOT1RFIHRoZSBtYXggYW5kIG1pbiBhcmUgSU5DTFVERUQgaW4gdGhlIHJhbmdlLiBTbzpcbiAgICAgKiAgY2hhbmNlLm5hdHVyYWwoe21pbjogMSwgbWF4OiAzfSk7XG4gICAgICogIHdvdWxkIHJldHVybiBlaXRoZXIgMSwgMiwgb3IgMy5cbiAgICAgKlxuICAgICAqICBAcGFyYW0ge09iamVjdH0gW29wdGlvbnM9e31dIGNhbiBzcGVjaWZ5IGEgbWluIGFuZC9vciBtYXhcbiAgICAgKiAgQHJldHVybnMge051bWJlcn0gYSBzaW5nbGUgcmFuZG9tIGludGVnZXIgbnVtYmVyXG4gICAgICogIEB0aHJvd3Mge1JhbmdlRXJyb3J9IG1pbiBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIG1heFxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUubmF0dXJhbCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bWluOiAwLCBtYXg6IE1BWF9JTlR9KTtcbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWluIDwgMCwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgbGVzcyB0aGFuIHplcm8uXCIpO1xuICAgICAgICByZXR1cm4gdGhpcy5pbnRlZ2VyKG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiAgUmV0dXJuIGEgcmFuZG9tIHN0cmluZ1xuICAgICAqXG4gICAgICogIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9ucz17fV0gY2FuIHNwZWNpZnkgYSBsZW5ndGhcbiAgICAgKiAgQHJldHVybnMge1N0cmluZ30gYSBzdHJpbmcgb2YgcmFuZG9tIGxlbmd0aFxuICAgICAqICBAdGhyb3dzIHtSYW5nZUVycm9yfSBsZW5ndGggY2Fubm90IGJlIGxlc3MgdGhhbiB6ZXJvXG4gICAgICovXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zdHJpbmcgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyBsZW5ndGg6IHRoaXMubmF0dXJhbCh7bWluOiA1LCBtYXg6IDIwfSkgfSk7XG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLmxlbmd0aCA8IDAsIFwiQ2hhbmNlOiBMZW5ndGggY2Fubm90IGJlIGxlc3MgdGhhbiB6ZXJvLlwiKTtcbiAgICAgICAgdmFyIGxlbmd0aCA9IG9wdGlvbnMubGVuZ3RoLFxuICAgICAgICAgICAgdGV4dCA9IHRoaXMubih0aGlzLmNoYXJhY3RlciwgbGVuZ3RoLCBvcHRpb25zKTtcblxuICAgICAgICByZXR1cm4gdGV4dC5qb2luKFwiXCIpO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgQmFzaWNzIC0tXG5cbiAgICAvLyAtLSBIZWxwZXJzIC0tXG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmNhcGl0YWxpemUgPSBmdW5jdGlvbiAod29yZCkge1xuICAgICAgICByZXR1cm4gd29yZC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHdvcmQuc3Vic3RyKDEpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm1peGluID0gZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBmb3IgKHZhciBmdW5jX25hbWUgaW4gb2JqKSB7XG4gICAgICAgICAgICBDaGFuY2UucHJvdG90eXBlW2Z1bmNfbmFtZV0gPSBvYmpbZnVuY19uYW1lXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogIEdpdmVuIGEgZnVuY3Rpb24gdGhhdCBnZW5lcmF0ZXMgc29tZXRoaW5nIHJhbmRvbSBhbmQgYSBudW1iZXIgb2YgaXRlbXMgdG8gZ2VuZXJhdGUsXG4gICAgICogICAgcmV0dXJuIGFuIGFycmF5IG9mIGl0ZW1zIHdoZXJlIG5vbmUgcmVwZWF0LlxuICAgICAqXG4gICAgICogIEBwYXJhbSB7RnVuY3Rpb259IGZuIHRoZSBmdW5jdGlvbiB0aGF0IGdlbmVyYXRlcyBzb21ldGhpbmcgcmFuZG9tXG4gICAgICogIEBwYXJhbSB7TnVtYmVyfSBudW0gbnVtYmVyIG9mIHRlcm1zIHRvIGdlbmVyYXRlXG4gICAgICogIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIGFueSBvcHRpb25zIHRvIHBhc3Mgb24gdG8gdGhlIGdlbmVyYXRvciBmdW5jdGlvblxuICAgICAqICBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IG9mIGxlbmd0aCBgbnVtYCB3aXRoIGV2ZXJ5IGl0ZW0gZ2VuZXJhdGVkIGJ5IGBmbmAgYW5kIHVuaXF1ZVxuICAgICAqXG4gICAgICogIFRoZXJlIGNhbiBiZSBtb3JlIHBhcmFtZXRlcnMgYWZ0ZXIgdGhlc2UuIEFsbCBhZGRpdGlvbmFsIHBhcmFtZXRlcnMgYXJlIHByb3ZpZGVkIHRvIHRoZSBnaXZlbiBmdW5jdGlvblxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUudW5pcXVlID0gZnVuY3Rpb24oZm4sIG51bSwgb3B0aW9ucykge1xuICAgICAgICB0ZXN0UmFuZ2UoXG4gICAgICAgICAgICB0eXBlb2YgZm4gIT09IFwiZnVuY3Rpb25cIixcbiAgICAgICAgICAgIFwiQ2hhbmNlOiBUaGUgZmlyc3QgYXJndW1lbnQgbXVzdCBiZSBhIGZ1bmN0aW9uLlwiXG4gICAgICAgICk7XG5cbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICAgICAgICAgIC8vIERlZmF1bHQgY29tcGFyYXRvciB0byBjaGVjayB0aGF0IHZhbCBpcyBub3QgYWxyZWFkeSBpbiBhcnIuXG4gICAgICAgICAgICAvLyBTaG91bGQgcmV0dXJuIGBmYWxzZWAgaWYgaXRlbSBub3QgaW4gYXJyYXksIGB0cnVlYCBvdGhlcndpc2VcbiAgICAgICAgICAgIGNvbXBhcmF0b3I6IGZ1bmN0aW9uKGFyciwgdmFsKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGFyci5pbmRleE9mKHZhbCkgIT09IC0xO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICB2YXIgYXJyID0gW10sIGNvdW50ID0gMCwgcmVzdWx0LCBNQVhfRFVQTElDQVRFUyA9IG51bSAqIDUwLCBwYXJhbXMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG5cbiAgICAgICAgd2hpbGUgKGFyci5sZW5ndGggPCBudW0pIHtcbiAgICAgICAgICAgIHJlc3VsdCA9IGZuLmFwcGx5KHRoaXMsIHBhcmFtcyk7XG4gICAgICAgICAgICBpZiAoIW9wdGlvbnMuY29tcGFyYXRvcihhcnIsIHJlc3VsdCkpIHtcbiAgICAgICAgICAgICAgICBhcnIucHVzaChyZXN1bHQpO1xuICAgICAgICAgICAgICAgIC8vIHJlc2V0IGNvdW50IHdoZW4gdW5pcXVlIGZvdW5kXG4gICAgICAgICAgICAgICAgY291bnQgPSAwO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoKytjb3VudCA+IE1BWF9EVVBMSUNBVEVTKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoXCJDaGFuY2U6IG51bSBpcyBsaWtlbHkgdG9vIGxhcmdlIGZvciBzYW1wbGUgc2V0XCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBhcnI7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqICBHaXZlcyBhbiBhcnJheSBvZiBuIHJhbmRvbSB0ZXJtc1xuICAgICAqXG4gICAgICogIEBwYXJhbSB7RnVuY3Rpb259IGZuIHRoZSBmdW5jdGlvbiB0aGF0IGdlbmVyYXRlcyBzb21ldGhpbmcgcmFuZG9tXG4gICAgICogIEBwYXJhbSB7TnVtYmVyfSBuIG51bWJlciBvZiB0ZXJtcyB0byBnZW5lcmF0ZVxuICAgICAqICBAcmV0dXJucyB7QXJyYXl9IGFuIGFycmF5IG9mIGxlbmd0aCBgbmAgd2l0aCBpdGVtcyBnZW5lcmF0ZWQgYnkgYGZuYFxuICAgICAqXG4gICAgICogIFRoZXJlIGNhbiBiZSBtb3JlIHBhcmFtZXRlcnMgYWZ0ZXIgdGhlc2UuIEFsbCBhZGRpdGlvbmFsIHBhcmFtZXRlcnMgYXJlIHByb3ZpZGVkIHRvIHRoZSBnaXZlbiBmdW5jdGlvblxuICAgICAqL1xuICAgIENoYW5jZS5wcm90b3R5cGUubiA9IGZ1bmN0aW9uKGZuLCBuKSB7XG4gICAgICAgIHRlc3RSYW5nZShcbiAgICAgICAgICAgIHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiLFxuICAgICAgICAgICAgXCJDaGFuY2U6IFRoZSBmaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgZnVuY3Rpb24uXCJcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAodHlwZW9mIG4gPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICBuID0gMTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgaSA9IG4sIGFyciA9IFtdLCBwYXJhbXMgPSBzbGljZS5jYWxsKGFyZ3VtZW50cywgMik7XG5cbiAgICAgICAgLy8gUHJvdmlkaW5nIGEgbmVnYXRpdmUgY291bnQgc2hvdWxkIHJlc3VsdCBpbiBhIG5vb3AuXG4gICAgICAgIGkgPSBNYXRoLm1heCggMCwgaSApO1xuXG4gICAgICAgIGZvciAobnVsbDsgaS0tOyBudWxsKSB7XG4gICAgICAgICAgICBhcnIucHVzaChmbi5hcHBseSh0aGlzLCBwYXJhbXMpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhcnI7XG4gICAgfTtcblxuICAgIC8vIEgvVCB0byBTTyBmb3IgdGhpcyBvbmU6IGh0dHA6Ly92cS5pby9PdFVyWjVcbiAgICBDaGFuY2UucHJvdG90eXBlLnBhZCA9IGZ1bmN0aW9uIChudW1iZXIsIHdpZHRoLCBwYWQpIHtcbiAgICAgICAgLy8gRGVmYXVsdCBwYWQgdG8gMCBpZiBub25lIHByb3ZpZGVkXG4gICAgICAgIHBhZCA9IHBhZCB8fCAnMCc7XG4gICAgICAgIC8vIENvbnZlcnQgbnVtYmVyIHRvIGEgc3RyaW5nXG4gICAgICAgIG51bWJlciA9IG51bWJlciArICcnO1xuICAgICAgICByZXR1cm4gbnVtYmVyLmxlbmd0aCA+PSB3aWR0aCA/IG51bWJlciA6IG5ldyBBcnJheSh3aWR0aCAtIG51bWJlci5sZW5ndGggKyAxKS5qb2luKHBhZCkgKyBudW1iZXI7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucGljayA9IGZ1bmN0aW9uIChhcnIsIGNvdW50KSB7XG4gICAgICAgIGlmIChhcnIubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkNoYW5jZTogQ2Fubm90IHBpY2soKSBmcm9tIGFuIGVtcHR5IGFycmF5XCIpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghY291bnQgfHwgY291bnQgPT09IDEpIHtcbiAgICAgICAgICAgIHJldHVybiBhcnJbdGhpcy5uYXR1cmFsKHttYXg6IGFyci5sZW5ndGggLSAxfSldO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuc2h1ZmZsZShhcnIpLnNsaWNlKDAsIGNvdW50KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnNodWZmbGUgPSBmdW5jdGlvbiAoYXJyKSB7XG4gICAgICAgIHZhciBvbGRfYXJyYXkgPSBhcnIuc2xpY2UoMCksXG4gICAgICAgICAgICBuZXdfYXJyYXkgPSBbXSxcbiAgICAgICAgICAgIGogPSAwLFxuICAgICAgICAgICAgbGVuZ3RoID0gTnVtYmVyKG9sZF9hcnJheS5sZW5ndGgpO1xuXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIC8vIFBpY2sgYSByYW5kb20gaW5kZXggZnJvbSB0aGUgYXJyYXlcbiAgICAgICAgICAgIGogPSB0aGlzLm5hdHVyYWwoe21heDogb2xkX2FycmF5Lmxlbmd0aCAtIDF9KTtcbiAgICAgICAgICAgIC8vIEFkZCBpdCB0byB0aGUgbmV3IGFycmF5XG4gICAgICAgICAgICBuZXdfYXJyYXlbaV0gPSBvbGRfYXJyYXlbal07XG4gICAgICAgICAgICAvLyBSZW1vdmUgdGhhdCBlbGVtZW50IGZyb20gdGhlIG9yaWdpbmFsIGFycmF5XG4gICAgICAgICAgICBvbGRfYXJyYXkuc3BsaWNlKGosIDEpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5ld19hcnJheTtcbiAgICB9O1xuXG4gICAgLy8gUmV0dXJucyBhIHNpbmdsZSBpdGVtIGZyb20gYW4gYXJyYXkgd2l0aCByZWxhdGl2ZSB3ZWlnaHRpbmcgb2Ygb2Rkc1xuICAgIENoYW5jZS5wcm90b3R5cGUud2VpZ2h0ZWQgPSBmdW5jdGlvbihhcnIsIHdlaWdodHMpIHtcbiAgICAgICAgaWYgKGFyci5sZW5ndGggIT09IHdlaWdodHMubGVuZ3RoKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkNoYW5jZTogbGVuZ3RoIG9mIGFycmF5IGFuZCB3ZWlnaHRzIG11c3QgbWF0Y2hcIik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBIYW5kbGUgd2VpZ2h0cyB0aGF0IGFyZSBsZXNzIG9yIGVxdWFsIHRvIHplcm8uXG4gICAgICAgIGZvciAodmFyIHdlaWdodEluZGV4ID0gd2VpZ2h0cy5sZW5ndGggLSAxOyB3ZWlnaHRJbmRleCA+PSAwOyAtLXdlaWdodEluZGV4KSB7XG4gICAgICAgICAgICAvLyBJZiB0aGUgd2VpZ2h0IGlzIGxlc3Mgb3IgZXF1YWwgdG8gemVybywgcmVtb3ZlIGl0IGFuZCB0aGUgdmFsdWUuXG4gICAgICAgICAgICBpZiAod2VpZ2h0c1t3ZWlnaHRJbmRleF0gPD0gMCkge1xuICAgICAgICAgICAgICAgIGFyci5zcGxpY2Uod2VpZ2h0SW5kZXgsMSk7XG4gICAgICAgICAgICAgICAgd2VpZ2h0cy5zcGxpY2Uod2VpZ2h0SW5kZXgsMSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBJZiBhbnkgb2YgdGhlIHdlaWdodHMgYXJlIGxlc3MgdGhhbiAxLCB3ZSB3YW50IHRvIHNjYWxlIHRoZW0gdXAgdG8gd2hvbGVcbiAgICAgICAgLy8gICBudW1iZXJzIGZvciB0aGUgcmVzdCBvZiB0aGlzIGxvZ2ljIHRvIHdvcmtcbiAgICAgICAgaWYgKHdlaWdodHMuc29tZShmdW5jdGlvbih3ZWlnaHQpIHsgcmV0dXJuIHdlaWdodCA8IDE7IH0pKSB7XG4gICAgICAgICAgICB2YXIgbWluID0gd2VpZ2h0cy5yZWR1Y2UoZnVuY3Rpb24obWluLCB3ZWlnaHQpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gKHdlaWdodCA8IG1pbikgPyB3ZWlnaHQgOiBtaW47XG4gICAgICAgICAgICB9LCB3ZWlnaHRzWzBdKTtcblxuICAgICAgICAgICAgdmFyIHNjYWxpbmdfZmFjdG9yID0gMSAvIG1pbjtcblxuICAgICAgICAgICAgd2VpZ2h0cyA9IHdlaWdodHMubWFwKGZ1bmN0aW9uKHdlaWdodCkge1xuICAgICAgICAgICAgICAgIHJldHVybiB3ZWlnaHQgKiBzY2FsaW5nX2ZhY3RvcjtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIHN1bSA9IHdlaWdodHMucmVkdWNlKGZ1bmN0aW9uKHRvdGFsLCB3ZWlnaHQpIHtcbiAgICAgICAgICAgIHJldHVybiB0b3RhbCArIHdlaWdodDtcbiAgICAgICAgfSwgMCk7XG5cbiAgICAgICAgLy8gZ2V0IGFuIGluZGV4XG4gICAgICAgIHZhciBzZWxlY3RlZCA9IHRoaXMubmF0dXJhbCh7IG1pbjogMSwgbWF4OiBzdW0gfSk7XG5cbiAgICAgICAgdmFyIHRvdGFsID0gMDtcbiAgICAgICAgdmFyIGNob3NlbjtcbiAgICAgICAgLy8gVXNpbmcgc29tZSgpIGhlcmUgc28gd2UgY2FuIGJhaWwgYXMgc29vbiBhcyB3ZSBnZXQgb3VyIG1hdGNoXG4gICAgICAgIHdlaWdodHMuc29tZShmdW5jdGlvbih3ZWlnaHQsIGluZGV4KSB7XG4gICAgICAgICAgICBpZiAoc2VsZWN0ZWQgPD0gdG90YWwgKyB3ZWlnaHQpIHtcbiAgICAgICAgICAgICAgICBjaG9zZW4gPSBhcnJbaW5kZXhdO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdG90YWwgKz0gd2VpZ2h0O1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gY2hvc2VuO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgSGVscGVycyAtLVxuXG4gICAgLy8gLS0gVGV4dCAtLVxuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wYXJhZ3JhcGggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICAgICAgdmFyIHNlbnRlbmNlcyA9IG9wdGlvbnMuc2VudGVuY2VzIHx8IHRoaXMubmF0dXJhbCh7bWluOiAzLCBtYXg6IDd9KSxcbiAgICAgICAgICAgIHNlbnRlbmNlX2FycmF5ID0gdGhpcy5uKHRoaXMuc2VudGVuY2UsIHNlbnRlbmNlcyk7XG5cbiAgICAgICAgcmV0dXJuIHNlbnRlbmNlX2FycmF5LmpvaW4oJyAnKTtcbiAgICB9O1xuXG4gICAgLy8gQ291bGQgZ2V0IHNtYXJ0ZXIgYWJvdXQgdGhpcyB0aGFuIGdlbmVyYXRpbmcgcmFuZG9tIHdvcmRzIGFuZFxuICAgIC8vIGNoYWluaW5nIHRoZW0gdG9nZXRoZXIuIFN1Y2ggYXM6IGh0dHA6Ly92cS5pby8xYTVjZU9oXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zZW50ZW5jZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgICB2YXIgd29yZHMgPSBvcHRpb25zLndvcmRzIHx8IHRoaXMubmF0dXJhbCh7bWluOiAxMiwgbWF4OiAxOH0pLFxuICAgICAgICAgICAgcHVuY3R1YXRpb24gPSBvcHRpb25zLnB1bmN0dWF0aW9uLFxuICAgICAgICAgICAgdGV4dCwgd29yZF9hcnJheSA9IHRoaXMubih0aGlzLndvcmQsIHdvcmRzKTtcblxuICAgICAgICB0ZXh0ID0gd29yZF9hcnJheS5qb2luKCcgJyk7XG4gICAgICAgIFxuICAgICAgICAvLyBDYXBpdGFsaXplIGZpcnN0IGxldHRlciBvZiBzZW50ZW5jZVxuICAgICAgICB0ZXh0ID0gdGhpcy5jYXBpdGFsaXplKHRleHQpO1xuICAgICAgICBcbiAgICAgICAgLy8gTWFrZSBzdXJlIHB1bmN0dWF0aW9uIGhhcyBhIHVzYWJsZSB2YWx1ZVxuICAgICAgICBpZiAocHVuY3R1YXRpb24gIT09IGZhbHNlICYmICEvXltcXC5cXD87ITpdJC8udGVzdChwdW5jdHVhdGlvbikpIHtcbiAgICAgICAgICAgIHB1bmN0dWF0aW9uID0gJy4nO1xuICAgICAgICB9XG4gICAgICAgIFxuICAgICAgICAvLyBBZGQgcHVuY3R1YXRpb24gbWFya1xuICAgICAgICBpZiAocHVuY3R1YXRpb24pIHtcbiAgICAgICAgICAgIHRleHQgKz0gcHVuY3R1YXRpb247XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGV4dDtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zeWxsYWJsZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgICB2YXIgbGVuZ3RoID0gb3B0aW9ucy5sZW5ndGggfHwgdGhpcy5uYXR1cmFsKHttaW46IDIsIG1heDogM30pLFxuICAgICAgICAgICAgY29uc29uYW50cyA9ICdiY2RmZ2hqa2xtbnByc3R2d3onLCAvLyBjb25zb25hbnRzIGV4Y2VwdCBoYXJkIHRvIHNwZWFrIG9uZXNcbiAgICAgICAgICAgIHZvd2VscyA9ICdhZWlvdScsIC8vIHZvd2Vsc1xuICAgICAgICAgICAgYWxsID0gY29uc29uYW50cyArIHZvd2VscywgLy8gYWxsXG4gICAgICAgICAgICB0ZXh0ID0gJycsXG4gICAgICAgICAgICBjaHI7XG5cbiAgICAgICAgLy8gSSdtIHN1cmUgdGhlcmUncyBhIG1vcmUgZWxlZ2FudCB3YXkgdG8gZG8gdGhpcywgYnV0IHRoaXMgd29ya3NcbiAgICAgICAgLy8gZGVjZW50bHkgd2VsbC5cbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgaWYgKGkgPT09IDApIHtcbiAgICAgICAgICAgICAgICAvLyBGaXJzdCBjaGFyYWN0ZXIgY2FuIGJlIGFueXRoaW5nXG4gICAgICAgICAgICAgICAgY2hyID0gdGhpcy5jaGFyYWN0ZXIoe3Bvb2w6IGFsbH0pO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjb25zb25hbnRzLmluZGV4T2YoY2hyKSA9PT0gLTEpIHtcbiAgICAgICAgICAgICAgICAvLyBMYXN0IGNoYXJhY3RlciB3YXMgYSB2b3dlbCwgbm93IHdlIHdhbnQgYSBjb25zb25hbnRcbiAgICAgICAgICAgICAgICBjaHIgPSB0aGlzLmNoYXJhY3Rlcih7cG9vbDogY29uc29uYW50c30pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBMYXN0IGNoYXJhY3RlciB3YXMgYSBjb25zb25hbnQsIG5vdyB3ZSB3YW50IGEgdm93ZWxcbiAgICAgICAgICAgICAgICBjaHIgPSB0aGlzLmNoYXJhY3Rlcih7cG9vbDogdm93ZWxzfSk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRleHQgKz0gY2hyO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRleHQ7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUud29yZCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgICB0ZXN0UmFuZ2UoXG4gICAgICAgICAgICBvcHRpb25zLnN5bGxhYmxlcyAmJiBvcHRpb25zLmxlbmd0aCxcbiAgICAgICAgICAgIFwiQ2hhbmNlOiBDYW5ub3Qgc3BlY2lmeSBib3RoIHN5bGxhYmxlcyBBTkQgbGVuZ3RoLlwiXG4gICAgICAgICk7XG5cbiAgICAgICAgdmFyIHN5bGxhYmxlcyA9IG9wdGlvbnMuc3lsbGFibGVzIHx8IHRoaXMubmF0dXJhbCh7bWluOiAxLCBtYXg6IDN9KSxcbiAgICAgICAgICAgIHRleHQgPSAnJztcblxuICAgICAgICBpZiAob3B0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgICAgIC8vIEVpdGhlciBib3VuZCB3b3JkIGJ5IGxlbmd0aFxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIHRleHQgKz0gdGhpcy5zeWxsYWJsZSgpO1xuICAgICAgICAgICAgfSB3aGlsZSAodGV4dC5sZW5ndGggPCBvcHRpb25zLmxlbmd0aCk7XG4gICAgICAgICAgICB0ZXh0ID0gdGV4dC5zdWJzdHJpbmcoMCwgb3B0aW9ucy5sZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gT3IgYnkgbnVtYmVyIG9mIHN5bGxhYmxlc1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBzeWxsYWJsZXM7IGkrKykge1xuICAgICAgICAgICAgICAgIHRleHQgKz0gdGhpcy5zeWxsYWJsZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0ZXh0O1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgVGV4dCAtLVxuXG4gICAgLy8gLS0gUGVyc29uIC0tXG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmFnZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgdmFyIGFnZVJhbmdlO1xuXG4gICAgICAgIHN3aXRjaCAob3B0aW9ucy50eXBlKSB7XG4gICAgICAgICAgICBjYXNlICdjaGlsZCc6XG4gICAgICAgICAgICAgICAgYWdlUmFuZ2UgPSB7bWluOiAxLCBtYXg6IDEyfTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3RlZW4nOlxuICAgICAgICAgICAgICAgIGFnZVJhbmdlID0ge21pbjogMTMsIG1heDogMTl9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnYWR1bHQnOlxuICAgICAgICAgICAgICAgIGFnZVJhbmdlID0ge21pbjogMTgsIG1heDogNjV9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAnc2VuaW9yJzpcbiAgICAgICAgICAgICAgICBhZ2VSYW5nZSA9IHttaW46IDY1LCBtYXg6IDEwMH07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlICdhbGwnOlxuICAgICAgICAgICAgICAgIGFnZVJhbmdlID0ge21pbjogMSwgbWF4OiAxMDB9O1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICBhZ2VSYW5nZSA9IHttaW46IDE4LCBtYXg6IDY1fTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLm5hdHVyYWwoYWdlUmFuZ2UpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmJpcnRoZGF5ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtcbiAgICAgICAgICAgIHllYXI6IChuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCkgLSB0aGlzLmFnZShvcHRpb25zKSlcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuZGF0ZShvcHRpb25zKTtcbiAgICB9O1xuXG4gICAgLy8gQ1BGOyBJRCB0byBpZGVudGlmeSB0YXhwYXllcnMgaW4gQnJhemlsXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jcGYgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBuID0gdGhpcy5uKHRoaXMubmF0dXJhbCwgOSwgeyBtYXg6IDkgfSk7XG4gICAgICAgIHZhciBkMSA9IG5bOF0qMituWzddKjMrbls2XSo0K25bNV0qNStuWzRdKjYrblszXSo3K25bMl0qOCtuWzFdKjkrblswXSoxMDtcbiAgICAgICAgZDEgPSAxMSAtIChkMSAlIDExKTtcbiAgICAgICAgaWYgKGQxPj0xMCkge1xuICAgICAgICAgICAgZDEgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHZhciBkMiA9IGQxKjIrbls4XSozK25bN10qNCtuWzZdKjUrbls1XSo2K25bNF0qNytuWzNdKjgrblsyXSo5K25bMV0qMTArblswXSoxMTtcbiAgICAgICAgZDIgPSAxMSAtIChkMiAlIDExKTtcbiAgICAgICAgaWYgKGQyPj0xMCkge1xuICAgICAgICAgICAgZDIgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAnJytuWzBdK25bMV0rblsyXSsnLicrblszXStuWzRdK25bNV0rJy4nK25bNl0rbls3XStuWzhdKyctJytkMStkMjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5maXJzdCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7Z2VuZGVyOiB0aGlzLmdlbmRlcigpfSk7XG4gICAgICAgIHJldHVybiB0aGlzLnBpY2sodGhpcy5nZXQoXCJmaXJzdE5hbWVzXCIpW29wdGlvbnMuZ2VuZGVyLnRvTG93ZXJDYXNlKCldKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5nZW5kZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnBpY2soWydNYWxlJywgJ0ZlbWFsZSddKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5sYXN0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5waWNrKHRoaXMuZ2V0KFwibGFzdE5hbWVzXCIpKTtcbiAgICB9O1xuICAgIFxuICAgIENoYW5jZS5wcm90b3R5cGUuaXNyYWVsSWQ9ZnVuY3Rpb24oKXtcbiAgICAgICAgdmFyIHg9dGhpcy5zdHJpbmcoe3Bvb2w6ICcwMTIzNDU2Nzg5JyxsZW5ndGg6OH0pO1xuICAgICAgICB2YXIgeT0wO1xuICAgICAgICBmb3IgKHZhciBpPTA7aTx4Lmxlbmd0aDtpKyspe1xuICAgICAgICAgICAgdmFyIHRoaXNEaWdpdD0gIHhbaV0gKiAgKGkvMj09PXBhcnNlSW50KGkvMikgPyAxIDogMik7XG4gICAgICAgICAgICB0aGlzRGlnaXQ9dGhpcy5wYWQodGhpc0RpZ2l0LDIpLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB0aGlzRGlnaXQ9cGFyc2VJbnQodGhpc0RpZ2l0WzBdKSArIHBhcnNlSW50KHRoaXNEaWdpdFsxXSk7XG4gICAgICAgICAgICB5PXkrdGhpc0RpZ2l0O1xuICAgICAgICB9XG4gICAgICAgIHg9eCsoMTAtcGFyc2VJbnQoeS50b1N0cmluZygpLnNsaWNlKC0xKSkpLnRvU3RyaW5nKCkuc2xpY2UoLTEpO1xuICAgICAgICByZXR1cm4geDtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5tcnogPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICB2YXIgY2hlY2tEaWdpdCA9IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgICAgICAgICAgdmFyIGFscGhhID0gXCI8QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVhaXCIuc3BsaXQoJycpLFxuICAgICAgICAgICAgICAgIG11bHRpcGxpZXJzID0gWyA3LCAzLCAxIF0sXG4gICAgICAgICAgICAgICAgcnVubmluZ1RvdGFsID0gMDtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBpbnB1dCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICBpbnB1dCA9IGlucHV0LnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlucHV0LnNwbGl0KCcnKS5mb3JFYWNoKGZ1bmN0aW9uKGNoYXJhY3RlciwgaWR4KSB7XG4gICAgICAgICAgICAgICAgdmFyIHBvcyA9IGFscGhhLmluZGV4T2YoY2hhcmFjdGVyKTtcblxuICAgICAgICAgICAgICAgIGlmKHBvcyAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgY2hhcmFjdGVyID0gcG9zID09PSAwID8gMCA6IHBvcyArIDk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgY2hhcmFjdGVyID0gcGFyc2VJbnQoY2hhcmFjdGVyLCAxMCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNoYXJhY3RlciAqPSBtdWx0aXBsaWVyc1tpZHggJSBtdWx0aXBsaWVycy5sZW5ndGhdO1xuICAgICAgICAgICAgICAgIHJ1bm5pbmdUb3RhbCArPSBjaGFyYWN0ZXI7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybiBydW5uaW5nVG90YWwgJSAxMDtcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIGdlbmVyYXRlID0gZnVuY3Rpb24gKG9wdHMpIHtcbiAgICAgICAgICAgIHZhciBwYWQgPSBmdW5jdGlvbiAobGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBBcnJheShsZW5ndGggKyAxKS5qb2luKCc8Jyk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdmFyIG51bWJlciA9IFsgJ1A8JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMuaXNzdWVyLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cy5sYXN0LnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAnPDwnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cy5maXJzdC50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFkKDM5IC0gKG9wdHMubGFzdC5sZW5ndGggKyBvcHRzLmZpcnN0Lmxlbmd0aCArIDIpKSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMucGFzc3BvcnROdW1iZXIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBjaGVja0RpZ2l0KG9wdHMucGFzc3BvcnROdW1iZXIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0cy5uYXRpb25hbGl0eSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMuZG9iLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tEaWdpdChvcHRzLmRvYiksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRzLmdlbmRlcixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdHMuZXhwaXJ5LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tEaWdpdChvcHRzLmV4cGlyeSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBwYWQoMTQpLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hlY2tEaWdpdChwYWQoMTQpKSBdLmpvaW4oJycpO1xuXG4gICAgICAgICAgICByZXR1cm4gbnVtYmVyICtcbiAgICAgICAgICAgICAgICAoY2hlY2tEaWdpdChudW1iZXIuc3Vic3RyKDQ0LCAxMCkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG51bWJlci5zdWJzdHIoNTcsIDcpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBudW1iZXIuc3Vic3RyKDY1LCA3KSkpO1xuICAgICAgICB9O1xuXG4gICAgICAgIHZhciB0aGF0ID0gdGhpcztcblxuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge1xuICAgICAgICAgICAgZmlyc3Q6IHRoaXMuZmlyc3QoKSxcbiAgICAgICAgICAgIGxhc3Q6IHRoaXMubGFzdCgpLFxuICAgICAgICAgICAgcGFzc3BvcnROdW1iZXI6IHRoaXMuaW50ZWdlcih7bWluOiAxMDAwMDAwMDAsIG1heDogOTk5OTk5OTk5fSksXG4gICAgICAgICAgICBkb2I6IChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgdmFyIGRhdGUgPSB0aGF0LmJpcnRoZGF5KHt0eXBlOiAnYWR1bHQnfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFtkYXRlLmdldEZ1bGxZZWFyKCkudG9TdHJpbmcoKS5zdWJzdHIoMiksXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGF0LnBhZChkYXRlLmdldE1vbnRoKCkgKyAxLCAyKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGFkKGRhdGUuZ2V0RGF0ZSgpLCAyKV0uam9pbignJyk7XG4gICAgICAgICAgICB9KCkpLFxuICAgICAgICAgICAgZXhwaXJ5OiAoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHZhciBkYXRlID0gbmV3IERhdGUoKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gWyhkYXRlLmdldEZ1bGxZZWFyKCkgKyA1KS50b1N0cmluZygpLnN1YnN0cigyKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQucGFkKGRhdGUuZ2V0TW9udGgoKSArIDEsIDIpLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGhhdC5wYWQoZGF0ZS5nZXREYXRlKCksIDIpXS5qb2luKCcnKTtcbiAgICAgICAgICAgIH0oKSksXG4gICAgICAgICAgICBnZW5kZXI6IHRoaXMuZ2VuZGVyKCkgPT09ICdGZW1hbGUnID8gJ0YnOiAnTScsXG4gICAgICAgICAgICBpc3N1ZXI6ICdHQlInLFxuICAgICAgICAgICAgbmF0aW9uYWxpdHk6ICdHQlInXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gZ2VuZXJhdGUgKG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm5hbWUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG5cbiAgICAgICAgdmFyIGZpcnN0ID0gdGhpcy5maXJzdChvcHRpb25zKSxcbiAgICAgICAgICAgIGxhc3QgPSB0aGlzLmxhc3QoKSxcbiAgICAgICAgICAgIG5hbWU7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMubWlkZGxlKSB7XG4gICAgICAgICAgICBuYW1lID0gZmlyc3QgKyAnICcgKyB0aGlzLmZpcnN0KG9wdGlvbnMpICsgJyAnICsgbGFzdDtcbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLm1pZGRsZV9pbml0aWFsKSB7XG4gICAgICAgICAgICBuYW1lID0gZmlyc3QgKyAnICcgKyB0aGlzLmNoYXJhY3Rlcih7YWxwaGE6IHRydWUsIGNhc2luZzogJ3VwcGVyJ30pICsgJy4gJyArIGxhc3Q7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuYW1lID0gZmlyc3QgKyAnICcgKyBsYXN0O1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMucHJlZml4KSB7XG4gICAgICAgICAgICBuYW1lID0gdGhpcy5wcmVmaXgob3B0aW9ucykgKyAnICcgKyBuYW1lO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuc3VmZml4KSB7XG4gICAgICAgICAgICBuYW1lID0gbmFtZSArICcgJyArIHRoaXMuc3VmZml4KG9wdGlvbnMpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG5hbWU7XG4gICAgfTtcblxuICAgIC8vIFJldHVybiB0aGUgbGlzdCBvZiBhdmFpbGFibGUgbmFtZSBwcmVmaXhlcyBiYXNlZCBvbiBzdXBwbGllZCBnZW5kZXIuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5uYW1lX3ByZWZpeGVzID0gZnVuY3Rpb24gKGdlbmRlcikge1xuICAgICAgICBnZW5kZXIgPSBnZW5kZXIgfHwgXCJhbGxcIjtcbiAgICAgICAgZ2VuZGVyID0gZ2VuZGVyLnRvTG93ZXJDYXNlKCk7XG5cbiAgICAgICAgdmFyIHByZWZpeGVzID0gW1xuICAgICAgICAgICAgeyBuYW1lOiAnRG9jdG9yJywgYWJicmV2aWF0aW9uOiAnRHIuJyB9XG4gICAgICAgIF07XG5cbiAgICAgICAgaWYgKGdlbmRlciA9PT0gXCJtYWxlXCIgfHwgZ2VuZGVyID09PSBcImFsbFwiKSB7XG4gICAgICAgICAgICBwcmVmaXhlcy5wdXNoKHsgbmFtZTogJ01pc3RlcicsIGFiYnJldmlhdGlvbjogJ01yLicgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZ2VuZGVyID09PSBcImZlbWFsZVwiIHx8IGdlbmRlciA9PT0gXCJhbGxcIikge1xuICAgICAgICAgICAgcHJlZml4ZXMucHVzaCh7IG5hbWU6ICdNaXNzJywgYWJicmV2aWF0aW9uOiAnTWlzcycgfSk7XG4gICAgICAgICAgICBwcmVmaXhlcy5wdXNoKHsgbmFtZTogJ01pc3NlcycsIGFiYnJldmlhdGlvbjogJ01ycy4nIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHByZWZpeGVzO1xuICAgIH07XG5cbiAgICAvLyBBbGlhcyBmb3IgbmFtZV9wcmVmaXhcbiAgICBDaGFuY2UucHJvdG90eXBlLnByZWZpeCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm5hbWVfcHJlZml4KG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm5hbWVfcHJlZml4ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgZ2VuZGVyOiBcImFsbFwiIH0pO1xuICAgICAgICByZXR1cm4gb3B0aW9ucy5mdWxsID9cbiAgICAgICAgICAgIHRoaXMucGljayh0aGlzLm5hbWVfcHJlZml4ZXMob3B0aW9ucy5nZW5kZXIpKS5uYW1lIDpcbiAgICAgICAgICAgIHRoaXMucGljayh0aGlzLm5hbWVfcHJlZml4ZXMob3B0aW9ucy5nZW5kZXIpKS5hYmJyZXZpYXRpb247XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuc3NuID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtzc25Gb3VyOiBmYWxzZSwgZGFzaGVzOiB0cnVlfSk7XG4gICAgICAgIHZhciBzc25fcG9vbCA9IFwiMTIzNDU2Nzg5MFwiLFxuICAgICAgICAgICAgc3NuLFxuICAgICAgICAgICAgZGFzaCA9IG9wdGlvbnMuZGFzaGVzID8gJy0nIDogJyc7XG5cbiAgICAgICAgaWYoIW9wdGlvbnMuc3NuRm91cikge1xuICAgICAgICAgICAgc3NuID0gdGhpcy5zdHJpbmcoe3Bvb2w6IHNzbl9wb29sLCBsZW5ndGg6IDN9KSArIGRhc2ggK1xuICAgICAgICAgICAgdGhpcy5zdHJpbmcoe3Bvb2w6IHNzbl9wb29sLCBsZW5ndGg6IDJ9KSArIGRhc2ggK1xuICAgICAgICAgICAgdGhpcy5zdHJpbmcoe3Bvb2w6IHNzbl9wb29sLCBsZW5ndGg6IDR9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHNzbiA9IHRoaXMuc3RyaW5nKHtwb29sOiBzc25fcG9vbCwgbGVuZ3RoOiA0fSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNzbjtcbiAgICB9O1xuXG4gICAgLy8gUmV0dXJuIHRoZSBsaXN0IG9mIGF2YWlsYWJsZSBuYW1lIHN1ZmZpeGVzXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5uYW1lX3N1ZmZpeGVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgc3VmZml4ZXMgPSBbXG4gICAgICAgICAgICB7IG5hbWU6ICdEb2N0b3Igb2YgT3N0ZW9wYXRoaWMgTWVkaWNpbmUnLCBhYmJyZXZpYXRpb246ICdELk8uJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnRG9jdG9yIG9mIFBoaWxvc29waHknLCBhYmJyZXZpYXRpb246ICdQaC5ELicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ0VzcXVpcmUnLCBhYmJyZXZpYXRpb246ICdFc3EuJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnSnVuaW9yJywgYWJicmV2aWF0aW9uOiAnSnIuJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnSnVyaXMgRG9jdG9yJywgYWJicmV2aWF0aW9uOiAnSi5ELicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ01hc3RlciBvZiBBcnRzJywgYWJicmV2aWF0aW9uOiAnTS5BLicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ01hc3RlciBvZiBCdXNpbmVzcyBBZG1pbmlzdHJhdGlvbicsIGFiYnJldmlhdGlvbjogJ00uQi5BLicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ01hc3RlciBvZiBTY2llbmNlJywgYWJicmV2aWF0aW9uOiAnTS5TLicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ01lZGljYWwgRG9jdG9yJywgYWJicmV2aWF0aW9uOiAnTS5ELicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ1NlbmlvcicsIGFiYnJldmlhdGlvbjogJ1NyLicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ1RoZSBUaGlyZCcsIGFiYnJldmlhdGlvbjogJ0lJSScgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ1RoZSBGb3VydGgnLCBhYmJyZXZpYXRpb246ICdJVicgfSxcbiAgICAgICAgICAgIHsgbmFtZTogJ0JhY2hlbG9yIG9mIEVuZ2luZWVyaW5nJywgYWJicmV2aWF0aW9uOiAnQi5FJyB9LFxuICAgICAgICAgICAgeyBuYW1lOiAnQmFjaGVsb3Igb2YgVGVjaG5vbG9neScsIGFiYnJldmlhdGlvbjogJ0IuVEVDSCcgfVxuICAgICAgICBdO1xuICAgICAgICByZXR1cm4gc3VmZml4ZXM7XG4gICAgfTtcblxuICAgIC8vIEFsaWFzIGZvciBuYW1lX3N1ZmZpeFxuICAgIENoYW5jZS5wcm90b3R5cGUuc3VmZml4ID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubmFtZV9zdWZmaXgob3B0aW9ucyk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubmFtZV9zdWZmaXggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHJldHVybiBvcHRpb25zLmZ1bGwgP1xuICAgICAgICAgICAgdGhpcy5waWNrKHRoaXMubmFtZV9zdWZmaXhlcygpKS5uYW1lIDpcbiAgICAgICAgICAgIHRoaXMucGljayh0aGlzLm5hbWVfc3VmZml4ZXMoKSkuYWJicmV2aWF0aW9uO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgUGVyc29uIC0tXG5cbiAgICAvLyAtLSBNb2JpbGUgLS1cbiAgICAvLyBBbmRyb2lkIEdDTSBSZWdpc3RyYXRpb24gSURcbiAgICBDaGFuY2UucHJvdG90eXBlLmFuZHJvaWRfaWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBcIkFQQTkxXCIgKyB0aGlzLnN0cmluZyh7IHBvb2w6IFwiMDEyMzQ1Njc4OWFiY2VmZ2hpamtsbW5vcHFyc3R1dnd4eXpBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWi1fXCIsIGxlbmd0aDogMTc4IH0pO1xuICAgIH07XG5cbiAgICAvLyBBcHBsZSBQdXNoIFRva2VuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5hcHBsZV90b2tlbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyaW5nKHsgcG9vbDogXCJhYmNkZWYxMjM0NTY3ODkwXCIsIGxlbmd0aDogNjQgfSk7XG4gICAgfTtcblxuICAgIC8vIFdpbmRvd3MgUGhvbmUgOCBBTklEMlxuICAgIENoYW5jZS5wcm90b3R5cGUud3A4X2FuaWQyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gYmFzZTY0KCB0aGlzLmhhc2goIHsgbGVuZ3RoIDogMzIgfSApICk7XG4gICAgfTtcblxuICAgIC8vIFdpbmRvd3MgUGhvbmUgNyBBTklEXG4gICAgQ2hhbmNlLnByb3RvdHlwZS53cDdfYW5pZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICdBPScgKyB0aGlzLmd1aWQoKS5yZXBsYWNlKC8tL2csICcnKS50b1VwcGVyQ2FzZSgpICsgJyZFPScgKyB0aGlzLmhhc2goeyBsZW5ndGg6MyB9KSArICcmVz0nICsgdGhpcy5pbnRlZ2VyKHsgbWluOjAsIG1heDo5IH0pO1xuICAgIH07XG5cbiAgICAvLyBCbGFja0JlcnJ5IERldmljZSBQSU5cbiAgICBDaGFuY2UucHJvdG90eXBlLmJiX3BpbiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuaGFzaCh7IGxlbmd0aDogOCB9KTtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIE1vYmlsZSAtLVxuXG4gICAgLy8gLS0gV2ViIC0tXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5hdmF0YXIgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICB2YXIgdXJsID0gbnVsbDtcbiAgICAgICAgdmFyIFVSTF9CQVNFID0gJy8vd3d3LmdyYXZhdGFyLmNvbS9hdmF0YXIvJztcbiAgICAgICAgdmFyIFBST1RPQ09MUyA9IHtcbiAgICAgICAgICAgIGh0dHA6ICdodHRwJyxcbiAgICAgICAgICAgIGh0dHBzOiAnaHR0cHMnXG4gICAgICAgIH07XG4gICAgICAgIHZhciBGSUxFX1RZUEVTID0ge1xuICAgICAgICAgICAgYm1wOiAnYm1wJyxcbiAgICAgICAgICAgIGdpZjogJ2dpZicsXG4gICAgICAgICAgICBqcGc6ICdqcGcnLFxuICAgICAgICAgICAgcG5nOiAncG5nJ1xuICAgICAgICB9O1xuICAgICAgICB2YXIgRkFMTEJBQ0tTID0ge1xuICAgICAgICAgICAgJzQwNCc6ICc0MDQnLCAvLyBSZXR1cm4gNDA0IGlmIG5vdCBmb3VuZFxuICAgICAgICAgICAgbW06ICdtbScsIC8vIE15c3RlcnkgbWFuXG4gICAgICAgICAgICBpZGVudGljb246ICdpZGVudGljb24nLCAvLyBHZW9tZXRyaWMgcGF0dGVybiBiYXNlZCBvbiBoYXNoXG4gICAgICAgICAgICBtb25zdGVyaWQ6ICdtb25zdGVyaWQnLCAvLyBBIGdlbmVyYXRlZCBtb25zdGVyIGljb25cbiAgICAgICAgICAgIHdhdmF0YXI6ICd3YXZhdGFyJywgLy8gQSBnZW5lcmF0ZWQgZmFjZVxuICAgICAgICAgICAgcmV0cm86ICdyZXRybycsIC8vIDgtYml0IGljb25cbiAgICAgICAgICAgIGJsYW5rOiAnYmxhbmsnIC8vIEEgdHJhbnNwYXJlbnQgcG5nXG4gICAgICAgIH07XG4gICAgICAgIHZhciBSQVRJTkdTID0ge1xuICAgICAgICAgICAgZzogJ2cnLFxuICAgICAgICAgICAgcGc6ICdwZycsXG4gICAgICAgICAgICByOiAncicsXG4gICAgICAgICAgICB4OiAneCdcbiAgICAgICAgfTtcbiAgICAgICAgdmFyIG9wdHMgPSB7XG4gICAgICAgICAgICBwcm90b2NvbDogbnVsbCxcbiAgICAgICAgICAgIGVtYWlsOiBudWxsLFxuICAgICAgICAgICAgZmlsZUV4dGVuc2lvbjogbnVsbCxcbiAgICAgICAgICAgIHNpemU6IG51bGwsXG4gICAgICAgICAgICBmYWxsYmFjazogbnVsbCxcbiAgICAgICAgICAgIHJhdGluZzogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmICghb3B0aW9ucykge1xuICAgICAgICAgICAgLy8gU2V0IHRvIGEgcmFuZG9tIGVtYWlsXG4gICAgICAgICAgICBvcHRzLmVtYWlsID0gdGhpcy5lbWFpbCgpO1xuICAgICAgICAgICAgb3B0aW9ucyA9IHt9O1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgb3B0cy5lbWFpbCA9IG9wdGlvbnM7XG4gICAgICAgICAgICBvcHRpb25zID0ge307XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmIChvcHRpb25zLmNvbnN0cnVjdG9yID09PSAnQXJyYXknKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIG9wdHMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCBvcHRzKTtcblxuICAgICAgICBpZiAoIW9wdHMuZW1haWwpIHtcbiAgICAgICAgICAgIC8vIFNldCB0byBhIHJhbmRvbSBlbWFpbFxuICAgICAgICAgICAgb3B0cy5lbWFpbCA9IHRoaXMuZW1haWwoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFNhZmUgY2hlY2tpbmcgZm9yIHBhcmFtc1xuICAgICAgICBvcHRzLnByb3RvY29sID0gUFJPVE9DT0xTW29wdHMucHJvdG9jb2xdID8gb3B0cy5wcm90b2NvbCArICc6JyA6ICcnO1xuICAgICAgICBvcHRzLnNpemUgPSBwYXJzZUludChvcHRzLnNpemUsIDApID8gb3B0cy5zaXplIDogJyc7XG4gICAgICAgIG9wdHMucmF0aW5nID0gUkFUSU5HU1tvcHRzLnJhdGluZ10gPyBvcHRzLnJhdGluZyA6ICcnO1xuICAgICAgICBvcHRzLmZhbGxiYWNrID0gRkFMTEJBQ0tTW29wdHMuZmFsbGJhY2tdID8gb3B0cy5mYWxsYmFjayA6ICcnO1xuICAgICAgICBvcHRzLmZpbGVFeHRlbnNpb24gPSBGSUxFX1RZUEVTW29wdHMuZmlsZUV4dGVuc2lvbl0gPyBvcHRzLmZpbGVFeHRlbnNpb24gOiAnJztcblxuICAgICAgICB1cmwgPVxuICAgICAgICAgICAgb3B0cy5wcm90b2NvbCArXG4gICAgICAgICAgICBVUkxfQkFTRSArXG4gICAgICAgICAgICB0aGlzLmJpbWQ1Lm1kNShvcHRzLmVtYWlsKSArXG4gICAgICAgICAgICAob3B0cy5maWxlRXh0ZW5zaW9uID8gJy4nICsgb3B0cy5maWxlRXh0ZW5zaW9uIDogJycpICtcbiAgICAgICAgICAgIChvcHRzLnNpemUgfHwgb3B0cy5yYXRpbmcgfHwgb3B0cy5mYWxsYmFjayA/ICc/JyA6ICcnKSArXG4gICAgICAgICAgICAob3B0cy5zaXplID8gJyZzPScgKyBvcHRzLnNpemUudG9TdHJpbmcoKSA6ICcnKSArXG4gICAgICAgICAgICAob3B0cy5yYXRpbmcgPyAnJnI9JyArIG9wdHMucmF0aW5nIDogJycpICtcbiAgICAgICAgICAgIChvcHRzLmZhbGxiYWNrID8gJyZkPScgKyBvcHRzLmZhbGxiYWNrIDogJycpXG4gICAgICAgICAgICA7XG5cbiAgICAgICAgcmV0dXJuIHVybDtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jb2xvciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIGZ1bmN0aW9uIGdyYXkodmFsdWUsIGRlbGltaXRlcikge1xuICAgICAgICAgICAgcmV0dXJuIFt2YWx1ZSwgdmFsdWUsIHZhbHVlXS5qb2luKGRlbGltaXRlciB8fCAnJyk7XG4gICAgICAgIH1cblxuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge1xuICAgICAgICAgICAgZm9ybWF0OiB0aGlzLnBpY2soWydoZXgnLCAnc2hvcnRoZXgnLCAncmdiJywgJ3JnYmEnLCAnMHgnXSksXG4gICAgICAgICAgICBncmF5c2NhbGU6IGZhbHNlLFxuICAgICAgICAgICAgY2FzaW5nOiAnbG93ZXInXG4gICAgICAgIH0pO1xuXG4gICAgICAgIHZhciBpc0dyYXlzY2FsZSA9IG9wdGlvbnMuZ3JheXNjYWxlO1xuICAgICAgICB2YXIgY29sb3JWYWx1ZTtcblxuICAgICAgICBpZiAob3B0aW9ucy5mb3JtYXQgPT09ICdoZXgnKSB7XG4gICAgICAgICAgICBjb2xvclZhbHVlID0gJyMnICsgKGlzR3JheXNjYWxlID8gZ3JheSh0aGlzLmhhc2goe2xlbmd0aDogMn0pKSA6IHRoaXMuaGFzaCh7bGVuZ3RoOiA2fSkpO1xuXG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5mb3JtYXQgPT09ICdzaG9ydGhleCcpIHtcbiAgICAgICAgICAgIGNvbG9yVmFsdWUgPSAnIycgKyAoaXNHcmF5c2NhbGUgPyBncmF5KHRoaXMuaGFzaCh7bGVuZ3RoOiAxfSkpIDogdGhpcy5oYXNoKHtsZW5ndGg6IDN9KSk7XG5cbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmZvcm1hdCA9PT0gJ3JnYicpIHtcbiAgICAgICAgICAgIGlmIChpc0dyYXlzY2FsZSkge1xuICAgICAgICAgICAgICAgIGNvbG9yVmFsdWUgPSAncmdiKCcgKyBncmF5KHRoaXMubmF0dXJhbCh7bWF4OiAyNTV9KSwgJywnKSArICcpJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29sb3JWYWx1ZSA9ICdyZ2IoJyArIHRoaXMubmF0dXJhbCh7bWF4OiAyNTV9KSArICcsJyArIHRoaXMubmF0dXJhbCh7bWF4OiAyNTV9KSArICcsJyArIHRoaXMubmF0dXJhbCh7bWF4OiAyNTV9KSArICcpJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmZvcm1hdCA9PT0gJ3JnYmEnKSB7XG4gICAgICAgICAgICBpZiAoaXNHcmF5c2NhbGUpIHtcbiAgICAgICAgICAgICAgICBjb2xvclZhbHVlID0gJ3JnYmEoJyArIGdyYXkodGhpcy5uYXR1cmFsKHttYXg6IDI1NX0pLCAnLCcpICsgJywnICsgdGhpcy5mbG9hdGluZyh7bWluOjAsIG1heDoxfSkgKyAnKSc7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbG9yVmFsdWUgPSAncmdiYSgnICsgdGhpcy5uYXR1cmFsKHttYXg6IDI1NX0pICsgJywnICsgdGhpcy5uYXR1cmFsKHttYXg6IDI1NX0pICsgJywnICsgdGhpcy5uYXR1cmFsKHttYXg6IDI1NX0pICsgJywnICsgdGhpcy5mbG9hdGluZyh7bWluOjAsIG1heDoxfSkgKyAnKSc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5mb3JtYXQgPT09ICcweCcpIHtcbiAgICAgICAgICAgIGNvbG9yVmFsdWUgPSAnMHgnICsgKGlzR3JheXNjYWxlID8gZ3JheSh0aGlzLmhhc2goe2xlbmd0aDogMn0pKSA6IHRoaXMuaGFzaCh7bGVuZ3RoOiA2fSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFJhbmdlRXJyb3IoJ0ludmFsaWQgZm9ybWF0IHByb3ZpZGVkLiBQbGVhc2UgcHJvdmlkZSBvbmUgb2YgXCJoZXhcIiwgXCJzaG9ydGhleFwiLCBcInJnYlwiLCBcInJnYmFcIiwgb3IgXCIweFwiLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuY2FzaW5nID09PSAndXBwZXInICkge1xuICAgICAgICAgICAgY29sb3JWYWx1ZSA9IGNvbG9yVmFsdWUudG9VcHBlckNhc2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBjb2xvclZhbHVlO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmRvbWFpbiA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIHRoaXMud29yZCgpICsgJy4nICsgKG9wdGlvbnMudGxkIHx8IHRoaXMudGxkKCkpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmVtYWlsID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICByZXR1cm4gdGhpcy53b3JkKHtsZW5ndGg6IG9wdGlvbnMubGVuZ3RofSkgKyAnQCcgKyAob3B0aW9ucy5kb21haW4gfHwgdGhpcy5kb21haW4oKSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZmJpZCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHBhcnNlSW50KCcxMDAwMCcgKyB0aGlzLm5hdHVyYWwoe21heDogMTAwMDAwMDAwMDAwfSksIDEwKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5nb29nbGVfYW5hbHl0aWNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYWNjb3VudCA9IHRoaXMucGFkKHRoaXMubmF0dXJhbCh7bWF4OiA5OTk5OTl9KSwgNik7XG4gICAgICAgIHZhciBwcm9wZXJ0eSA9IHRoaXMucGFkKHRoaXMubmF0dXJhbCh7bWF4OiA5OX0pLCAyKTtcblxuICAgICAgICByZXR1cm4gJ1VBLScgKyBhY2NvdW50ICsgJy0nICsgcHJvcGVydHk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuaGFzaHRhZyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICcjJyArIHRoaXMud29yZCgpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmlwID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBUb2RvOiBUaGlzIGNvdWxkIHJldHVybiBzb21lIHJlc2VydmVkIElQcy4gU2VlIGh0dHA6Ly92cS5pby8xMzdkZ1l5XG4gICAgICAgIC8vIHRoaXMgc2hvdWxkIHByb2JhYmx5IGJlIHVwZGF0ZWQgdG8gYWNjb3VudCBmb3IgdGhhdCByYXJlIGFzIGl0IG1heSBiZVxuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHttYXg6IDI1NX0pICsgJy4nICtcbiAgICAgICAgICAgICAgIHRoaXMubmF0dXJhbCh7bWF4OiAyNTV9KSArICcuJyArXG4gICAgICAgICAgICAgICB0aGlzLm5hdHVyYWwoe21heDogMjU1fSkgKyAnLicgK1xuICAgICAgICAgICAgICAgdGhpcy5uYXR1cmFsKHttYXg6IDI1NX0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmlwdjYgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBpcF9hZGRyID0gdGhpcy5uKHRoaXMuaGFzaCwgOCwge2xlbmd0aDogNH0pO1xuXG4gICAgICAgIHJldHVybiBpcF9hZGRyLmpvaW4oXCI6XCIpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmtsb3V0ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogOTl9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS50bGRzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gWydjb20nLCAnb3JnJywgJ2VkdScsICdnb3YnLCAnY28udWsnLCAnbmV0JywgJ2lvJ107XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUudGxkID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5waWNrKHRoaXMudGxkcygpKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS50d2l0dGVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gJ0AnICsgdGhpcy53b3JkKCk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUudXJsID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgcHJvdG9jb2w6IFwiaHR0cFwiLCBkb21haW46IHRoaXMuZG9tYWluKG9wdGlvbnMpLCBkb21haW5fcHJlZml4OiBcIlwiLCBwYXRoOiB0aGlzLndvcmQoKSwgZXh0ZW5zaW9uczogW119KTtcblxuICAgICAgICB2YXIgZXh0ZW5zaW9uID0gb3B0aW9ucy5leHRlbnNpb25zLmxlbmd0aCA+IDAgPyBcIi5cIiArIHRoaXMucGljayhvcHRpb25zLmV4dGVuc2lvbnMpIDogXCJcIjtcbiAgICAgICAgdmFyIGRvbWFpbiA9IG9wdGlvbnMuZG9tYWluX3ByZWZpeCA/IG9wdGlvbnMuZG9tYWluX3ByZWZpeCArIFwiLlwiICsgb3B0aW9ucy5kb21haW4gOiBvcHRpb25zLmRvbWFpbjtcblxuICAgICAgICByZXR1cm4gb3B0aW9ucy5wcm90b2NvbCArIFwiOi8vXCIgKyBkb21haW4gKyBcIi9cIiArIG9wdGlvbnMucGF0aCArIGV4dGVuc2lvbjtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIFdlYiAtLVxuXG4gICAgLy8gLS0gTG9jYXRpb24gLS1cblxuICAgIENoYW5jZS5wcm90b3R5cGUuYWRkcmVzcyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbCh7bWluOiA1LCBtYXg6IDIwMDB9KSArICcgJyArIHRoaXMuc3RyZWV0KG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmFsdGl0dWRlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtmaXhlZDogNSwgbWluOiAwLCBtYXg6IDg4NDh9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmxvYXRpbmcoe1xuICAgICAgICAgICAgbWluOiBvcHRpb25zLm1pbixcbiAgICAgICAgICAgIG1heDogb3B0aW9ucy5tYXgsXG4gICAgICAgICAgICBmaXhlZDogb3B0aW9ucy5maXhlZFxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5hcmVhY29kZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7cGFyZW5zIDogdHJ1ZX0pO1xuICAgICAgICAvLyBEb24ndCB3YW50IGFyZWEgY29kZXMgdG8gc3RhcnQgd2l0aCAxLCBvciBoYXZlIGEgOSBhcyB0aGUgc2Vjb25kIGRpZ2l0XG4gICAgICAgIHZhciBhcmVhY29kZSA9IHRoaXMubmF0dXJhbCh7bWluOiAyLCBtYXg6IDl9KS50b1N0cmluZygpICtcbiAgICAgICAgICAgICAgICB0aGlzLm5hdHVyYWwoe21pbjogMCwgbWF4OiA4fSkudG9TdHJpbmcoKSArXG4gICAgICAgICAgICAgICAgdGhpcy5uYXR1cmFsKHttaW46IDAsIG1heDogOX0pLnRvU3RyaW5nKCk7XG5cbiAgICAgICAgcmV0dXJuIG9wdGlvbnMucGFyZW5zID8gJygnICsgYXJlYWNvZGUgKyAnKScgOiBhcmVhY29kZTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jaXR5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jYXBpdGFsaXplKHRoaXMud29yZCh7c3lsbGFibGVzOiAzfSkpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmNvb3JkaW5hdGVzID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubGF0aXR1ZGUob3B0aW9ucykgKyAnLCAnICsgdGhpcy5sb25naXR1ZGUob3B0aW9ucyk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuY291bnRyaWVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXQoXCJjb3VudHJpZXNcIik7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuY291bnRyeSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgdmFyIGNvdW50cnkgPSB0aGlzLnBpY2sodGhpcy5jb3VudHJpZXMoKSk7XG4gICAgICAgIHJldHVybiBvcHRpb25zLmZ1bGwgPyBjb3VudHJ5Lm5hbWUgOiBjb3VudHJ5LmFiYnJldmlhdGlvbjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kZXB0aCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7Zml4ZWQ6IDUsIG1pbjogLTEwOTk0LCBtYXg6IDB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmxvYXRpbmcoe1xuICAgICAgICAgICAgbWluOiBvcHRpb25zLm1pbixcbiAgICAgICAgICAgIG1heDogb3B0aW9ucy5tYXgsXG4gICAgICAgICAgICBmaXhlZDogb3B0aW9ucy5maXhlZFxuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5nZW9oYXNoID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgbGVuZ3RoOiA3IH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5zdHJpbmcoeyBsZW5ndGg6IG9wdGlvbnMubGVuZ3RoLCBwb29sOiAnMDEyMzQ1Njc4OWJjZGVmZ2hqa21ucHFyc3R1dnd4eXonIH0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmdlb2pzb24gPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5sYXRpdHVkZShvcHRpb25zKSArICcsICcgKyB0aGlzLmxvbmdpdHVkZShvcHRpb25zKSArICcsICcgKyB0aGlzLmFsdGl0dWRlKG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmxhdGl0dWRlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtmaXhlZDogNSwgbWluOiAtOTAsIG1heDogOTB9KTtcbiAgICAgICAgcmV0dXJuIHRoaXMuZmxvYXRpbmcoe21pbjogb3B0aW9ucy5taW4sIG1heDogb3B0aW9ucy5tYXgsIGZpeGVkOiBvcHRpb25zLmZpeGVkfSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubG9uZ2l0dWRlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHtmaXhlZDogNSwgbWluOiAtMTgwLCBtYXg6IDE4MH0pO1xuICAgICAgICByZXR1cm4gdGhpcy5mbG9hdGluZyh7bWluOiBvcHRpb25zLm1pbiwgbWF4OiBvcHRpb25zLm1heCwgZml4ZWQ6IG9wdGlvbnMuZml4ZWR9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5waG9uZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcyxcbiAgICAgICAgICAgIG51bVBpY2ssXG4gICAgICAgICAgICB1a051bSA9IGZ1bmN0aW9uIChwYXJ0cykge1xuICAgICAgICAgICAgICAgIHZhciBzZWN0aW9uID0gW107XG4gICAgICAgICAgICAgICAgLy9maWxscyB0aGUgc2VjdGlvbiBwYXJ0IG9mIHRoZSBwaG9uZSBudW1iZXIgd2l0aCByYW5kb20gbnVtYmVycy5cbiAgICAgICAgICAgICAgICBwYXJ0cy5zZWN0aW9ucy5mb3JFYWNoKGZ1bmN0aW9uKG4pIHtcbiAgICAgICAgICAgICAgICAgICAgc2VjdGlvbi5wdXNoKHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IG59KSk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHBhcnRzLmFyZWEgKyBzZWN0aW9uLmpvaW4oJyAnKTtcbiAgICAgICAgICAgIH07XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7XG4gICAgICAgICAgICBmb3JtYXR0ZWQ6IHRydWUsXG4gICAgICAgICAgICBjb3VudHJ5OiAndXMnLFxuICAgICAgICAgICAgbW9iaWxlOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCFvcHRpb25zLmZvcm1hdHRlZCkge1xuICAgICAgICAgICAgb3B0aW9ucy5wYXJlbnMgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgcGhvbmU7XG4gICAgICAgIHN3aXRjaCAob3B0aW9ucy5jb3VudHJ5KSB7XG4gICAgICAgICAgICBjYXNlICdmcic6XG4gICAgICAgICAgICAgICAgaWYgKCFvcHRpb25zLm1vYmlsZSkge1xuICAgICAgICAgICAgICAgICAgICBudW1QaWNrID0gdGhpcy5waWNrKFtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFZhbGlkIHpvbmUgYW5kIGTDqXBhcnRlbWVudCBjb2Rlcy5cbiAgICAgICAgICAgICAgICAgICAgICAgICcwMScgKyB0aGlzLnBpY2soWyczMCcsICczNCcsICczOScsICc0MCcsICc0MScsICc0MicsICc0MycsICc0NCcsICc0NScsICc0NicsICc0NycsICc0OCcsICc0OScsICc1MycsICc1NScsICc1NicsICc1OCcsICc2MCcsICc2NCcsICc2OScsICc3MCcsICc3MicsICc3MycsICc3NCcsICc3NScsICc3NicsICc3NycsICc3OCcsICc3OScsICc4MCcsICc4MScsICc4MicsICc4MyddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDZ9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwMicgKyB0aGlzLnBpY2soWycxNCcsICcxOCcsICcyMicsICcyMycsICcyOCcsICcyOScsICczMCcsICczMScsICczMicsICczMycsICczNCcsICczNScsICczNicsICczNycsICczOCcsICc0MCcsICc0MScsICc0MycsICc0NCcsICc0NScsICc0NicsICc0NycsICc0OCcsICc0OScsICc1MCcsICc1MScsICc1MicsICc1MycsICc1NCcsICc1NicsICc1NycsICc2MScsICc2MicsICc2OScsICc3MicsICc3NicsICc3NycsICc3OCcsICc4NScsICc5MCcsICc5NicsICc5NycsICc5OCcsICc5OSddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDZ9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwMycgKyB0aGlzLnBpY2soWycxMCcsICcyMCcsICcyMScsICcyMicsICcyMycsICcyNCcsICcyNScsICcyNicsICcyNycsICcyOCcsICcyOScsICczOScsICc0NCcsICc0NScsICc1MScsICc1MicsICc1NCcsICc1NScsICc1NycsICc1OCcsICc1OScsICc2MCcsICc2MScsICc2MicsICc2MycsICc2NCcsICc2NScsICc2NicsICc2NycsICc2OCcsICc2OScsICc3MCcsICc3MScsICc3MicsICc3MycsICc4MCcsICc4MScsICc4MicsICc4MycsICc4NCcsICc4NScsICc4NicsICc4NycsICc4OCcsICc4OScsICc5MCddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDZ9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwNCcgKyB0aGlzLnBpY2soWycxMScsICcxMycsICcxNScsICcyMCcsICcyMicsICcyNicsICcyNycsICczMCcsICczMicsICczNCcsICczNycsICc0MicsICc0MycsICc0NCcsICc1MCcsICc1NicsICc1NycsICc2MycsICc2NicsICc2NycsICc2OCcsICc2OScsICc3MCcsICc3MScsICc3MicsICc3MycsICc3NCcsICc3NScsICc3NicsICc3NycsICc3OCcsICc3OScsICc4MCcsICc4MScsICc4MicsICc4MycsICc4NCcsICc4NScsICc4NicsICc4OCcsICc4OScsICc5MCcsICc5MScsICc5MicsICc5MycsICc5NCcsICc5NScsICc5NycsICc5OCddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDZ9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwNScgKyB0aGlzLnBpY2soWycwOCcsICcxNicsICcxNycsICcxOScsICcyNCcsICczMScsICczMicsICczMycsICczNCcsICczNScsICc0MCcsICc0NScsICc0NicsICc0NycsICc0OScsICc1MycsICc1NScsICc1NicsICc1NycsICc1OCcsICc1OScsICc2MScsICc2MicsICc2MycsICc2NCcsICc2NScsICc2NycsICc3OScsICc4MScsICc4MicsICc4NicsICc4NycsICc5MCcsICc5NCddKSArIHNlbGYuc3RyaW5nKHsgcG9vbDogJzAxMjM0NTY3ODknLCBsZW5ndGg6IDZ9KSxcbiAgICAgICAgICAgICAgICAgICAgICAgICcwOScgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA4fSksXG4gICAgICAgICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgICAgICAgICBwaG9uZSA9IG9wdGlvbnMuZm9ybWF0dGVkID8gbnVtUGljay5tYXRjaCgvLi4vZykuam9pbignICcpIDogbnVtUGljaztcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBudW1QaWNrID0gdGhpcy5waWNrKFsnMDYnLCAnMDcnXSkgKyBzZWxmLnN0cmluZyh7IHBvb2w6ICcwMTIzNDU2Nzg5JywgbGVuZ3RoOiA4fSk7XG4gICAgICAgICAgICAgICAgICAgIHBob25lID0gb3B0aW9ucy5mb3JtYXR0ZWQgPyBudW1QaWNrLm1hdGNoKC8uLi9nKS5qb2luKCcgJykgOiBudW1QaWNrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgJ3VrJzpcbiAgICAgICAgICAgICAgICBpZiAoIW9wdGlvbnMubW9iaWxlKSB7XG4gICAgICAgICAgICAgICAgICAgIG51bVBpY2sgPSB0aGlzLnBpY2soW1xuICAgICAgICAgICAgICAgICAgICAgICAgLy92YWxpZCBhcmVhIGNvZGVzIG9mIG1ham9yIGNpdGllcy9jb3VudGllcyBmb2xsb3dlZCBieSByYW5kb20gbnVtYmVycyBpbiByZXF1aXJlZCBmb3JtYXQuXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMScgKyB0aGlzLmNoYXJhY3Rlcih7IHBvb2w6ICcyMzQ1NjknIH0pICsgJzEgJywgc2VjdGlvbnM6IFszLDRdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMjAgJyArIHRoaXMuY2hhcmFjdGVyKHsgcG9vbDogJzM3OCcgfSksIHNlY3Rpb25zOiBbMyw0XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDIzICcgKyB0aGlzLmNoYXJhY3Rlcih7IHBvb2w6ICc4OScgfSksIHNlY3Rpb25zOiBbMyw0XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDI0IDcnLCBzZWN0aW9uczogWzMsNF0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAyOCAnICsgdGhpcy5waWNrKFsnMjUnLCcyOCcsJzM3JywnNzEnLCc4MicsJzkwJywnOTInLCc5NSddKSwgc2VjdGlvbnM6IFsyLDRdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMTInICsgdGhpcy5waWNrKFsnMDQnLCcwOCcsJzU0JywnNzYnLCc5NycsJzk4J10pICsgJyAnLCBzZWN0aW9uczogWzVdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMTMnICsgdGhpcy5waWNrKFsnNjMnLCc2NCcsJzg0JywnODYnXSkgKyAnICcsIHNlY3Rpb25zOiBbNV0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAxNCcgKyB0aGlzLnBpY2soWycwNCcsJzIwJywnNjAnLCc2MScsJzgwJywnODgnXSkgKyAnICcsIHNlY3Rpb25zOiBbNV0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAxNScgKyB0aGlzLnBpY2soWycyNCcsJzI3JywnNjInLCc2NiddKSArICcgJywgc2VjdGlvbnM6IFs1XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDE2JyArIHRoaXMucGljayhbJzA2JywnMjknLCczNScsJzQ3JywnNTknLCc5NSddKSArICcgJywgc2VjdGlvbnM6IFs1XSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBhcmVhOiAnMDE3JyArIHRoaXMucGljayhbJzI2JywnNDQnLCc1MCcsJzY4J10pICsgJyAnLCBzZWN0aW9uczogWzVdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwMTgnICsgdGhpcy5waWNrKFsnMjcnLCczNycsJzg0JywnOTcnXSkgKyAnICcsIHNlY3Rpb25zOiBbNV0gfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHsgYXJlYTogJzAxOScgKyB0aGlzLnBpY2soWycwMCcsJzA1JywnMzUnLCc0NicsJzQ5JywnNjMnLCc5NSddKSArICcgJywgc2VjdGlvbnM6IFs1XSB9XG4gICAgICAgICAgICAgICAgICAgIF0pO1xuICAgICAgICAgICAgICAgICAgICBwaG9uZSA9IG9wdGlvbnMuZm9ybWF0dGVkID8gdWtOdW0obnVtUGljaykgOiB1a051bShudW1QaWNrKS5yZXBsYWNlKCcgJywgJycsICdnJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgbnVtUGljayA9IHRoaXMucGljayhbXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwNycgKyB0aGlzLnBpY2soWyc0JywnNScsJzcnLCc4JywnOSddKSwgc2VjdGlvbnM6IFsyLDZdIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGFyZWE6ICcwNzYyNCAnLCBzZWN0aW9uczogWzZdIH1cbiAgICAgICAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgICAgICAgIHBob25lID0gb3B0aW9ucy5mb3JtYXR0ZWQgPyB1a051bShudW1QaWNrKSA6IHVrTnVtKG51bVBpY2spLnJlcGxhY2UoJyAnLCAnJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSAndXMnOlxuICAgICAgICAgICAgICAgIHZhciBhcmVhY29kZSA9IHRoaXMuYXJlYWNvZGUob3B0aW9ucykudG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICB2YXIgZXhjaGFuZ2UgPSB0aGlzLm5hdHVyYWwoeyBtaW46IDIsIG1heDogOSB9KS50b1N0cmluZygpICtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5uYXR1cmFsKHsgbWluOiAwLCBtYXg6IDkgfSkudG9TdHJpbmcoKSArXG4gICAgICAgICAgICAgICAgICAgIHRoaXMubmF0dXJhbCh7IG1pbjogMCwgbWF4OiA5IH0pLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICAgICAgdmFyIHN1YnNjcmliZXIgPSB0aGlzLm5hdHVyYWwoeyBtaW46IDEwMDAsIG1heDogOTk5OSB9KS50b1N0cmluZygpOyAvLyB0aGlzIGNvdWxkIGJlIHJhbmRvbSBbMC05XXs0fVxuICAgICAgICAgICAgICAgIHBob25lID0gb3B0aW9ucy5mb3JtYXR0ZWQgPyBhcmVhY29kZSArICcgJyArIGV4Y2hhbmdlICsgJy0nICsgc3Vic2NyaWJlciA6IGFyZWFjb2RlICsgZXhjaGFuZ2UgKyBzdWJzY3JpYmVyO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwaG9uZTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wb3N0YWwgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIFBvc3RhbCBEaXN0cmljdFxuICAgICAgICB2YXIgcGQgPSB0aGlzLmNoYXJhY3Rlcih7cG9vbDogXCJYVlRTUlBOS0xNSEpHRUNCQVwifSk7XG4gICAgICAgIC8vIEZvcndhcmQgU29ydGF0aW9uIEFyZWEgKEZTQSlcbiAgICAgICAgdmFyIGZzYSA9IHBkICsgdGhpcy5uYXR1cmFsKHttYXg6IDl9KSArIHRoaXMuY2hhcmFjdGVyKHthbHBoYTogdHJ1ZSwgY2FzaW5nOiBcInVwcGVyXCJ9KTtcbiAgICAgICAgLy8gTG9jYWwgRGVsaXZlcnkgVW51dCAoTERVKVxuICAgICAgICB2YXIgbGR1ID0gdGhpcy5uYXR1cmFsKHttYXg6IDl9KSArIHRoaXMuY2hhcmFjdGVyKHthbHBoYTogdHJ1ZSwgY2FzaW5nOiBcInVwcGVyXCJ9KSArIHRoaXMubmF0dXJhbCh7bWF4OiA5fSk7XG5cbiAgICAgICAgcmV0dXJuIGZzYSArIFwiIFwiICsgbGR1O1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnByb3ZpbmNlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KFwicHJvdmluY2VzXCIpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnByb3ZpbmNlID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuIChvcHRpb25zICYmIG9wdGlvbnMuZnVsbCkgP1xuICAgICAgICAgICAgdGhpcy5waWNrKHRoaXMucHJvdmluY2VzKCkpLm5hbWUgOlxuICAgICAgICAgICAgdGhpcy5waWNrKHRoaXMucHJvdmluY2VzKCkpLmFiYnJldmlhdGlvbjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zdGF0ZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiAob3B0aW9ucyAmJiBvcHRpb25zLmZ1bGwpID9cbiAgICAgICAgICAgIHRoaXMucGljayh0aGlzLnN0YXRlcyhvcHRpb25zKSkubmFtZSA6XG4gICAgICAgICAgICB0aGlzLnBpY2sodGhpcy5zdGF0ZXMob3B0aW9ucykpLmFiYnJldmlhdGlvbjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zdGF0ZXMgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywgeyB1c19zdGF0ZXNfYW5kX2RjOiB0cnVlIH0pO1xuXG4gICAgICAgIHZhciBzdGF0ZXMsXG4gICAgICAgICAgICB1c19zdGF0ZXNfYW5kX2RjID0gdGhpcy5nZXQoXCJ1c19zdGF0ZXNfYW5kX2RjXCIpLFxuICAgICAgICAgICAgdGVycml0b3JpZXMgPSB0aGlzLmdldChcInRlcnJpdG9yaWVzXCIpLFxuICAgICAgICAgICAgYXJtZWRfZm9yY2VzID0gdGhpcy5nZXQoXCJhcm1lZF9mb3JjZXNcIik7XG5cbiAgICAgICAgc3RhdGVzID0gW107XG5cbiAgICAgICAgaWYgKG9wdGlvbnMudXNfc3RhdGVzX2FuZF9kYykge1xuICAgICAgICAgICAgc3RhdGVzID0gc3RhdGVzLmNvbmNhdCh1c19zdGF0ZXNfYW5kX2RjKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAob3B0aW9ucy50ZXJyaXRvcmllcykge1xuICAgICAgICAgICAgc3RhdGVzID0gc3RhdGVzLmNvbmNhdCh0ZXJyaXRvcmllcyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG9wdGlvbnMuYXJtZWRfZm9yY2VzKSB7XG4gICAgICAgICAgICBzdGF0ZXMgPSBzdGF0ZXMuY29uY2F0KGFybWVkX2ZvcmNlcyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc3RhdGVzO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnN0cmVldCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgICB2YXIgc3RyZWV0ID0gdGhpcy53b3JkKHtzeWxsYWJsZXM6IDJ9KTtcbiAgICAgICAgc3RyZWV0ID0gdGhpcy5jYXBpdGFsaXplKHN0cmVldCk7XG4gICAgICAgIHN0cmVldCArPSAnICc7XG4gICAgICAgIHN0cmVldCArPSBvcHRpb25zLnNob3J0X3N1ZmZpeCA/XG4gICAgICAgICAgICB0aGlzLnN0cmVldF9zdWZmaXgoKS5hYmJyZXZpYXRpb24gOlxuICAgICAgICAgICAgdGhpcy5zdHJlZXRfc3VmZml4KCkubmFtZTtcbiAgICAgICAgcmV0dXJuIHN0cmVldDtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5zdHJlZXRfc3VmZml4ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5waWNrKHRoaXMuc3RyZWV0X3N1ZmZpeGVzKCkpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnN0cmVldF9zdWZmaXhlcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gVGhlc2UgYXJlIHRoZSBtb3N0IGNvbW1vbiBzdWZmaXhlcy5cbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KFwic3RyZWV0X3N1ZmZpeGVzXCIpO1xuICAgIH07XG5cbiAgICAvLyBOb3RlOiBvbmx5IHJldHVybmluZyBVUyB6aXAgY29kZXMsIGludGVybmF0aW9uYWxpemF0aW9uIHdpbGwgYmUgYSB3aG9sZVxuICAgIC8vIG90aGVyIGJlYXN0IHRvIHRhY2tsZSBhdCBzb21lIHBvaW50LlxuICAgIENoYW5jZS5wcm90b3R5cGUuemlwID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgdmFyIHppcCA9IHRoaXMubih0aGlzLm5hdHVyYWwsIDUsIHttYXg6IDl9KTtcblxuICAgICAgICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnBsdXNmb3VyID09PSB0cnVlKSB7XG4gICAgICAgICAgICB6aXAucHVzaCgnLScpO1xuICAgICAgICAgICAgemlwID0gemlwLmNvbmNhdCh0aGlzLm4odGhpcy5uYXR1cmFsLCA0LCB7bWF4OiA5fSkpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHppcC5qb2luKFwiXCIpO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgTG9jYXRpb24gLS1cblxuICAgIC8vIC0tIFRpbWVcblxuICAgIENoYW5jZS5wcm90b3R5cGUuYW1wbSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuYm9vbCgpID8gJ2FtJyA6ICdwbSc7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZGF0ZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHZhciBkYXRlX3N0cmluZywgZGF0ZTtcblxuICAgICAgICAvLyBJZiBpbnRlcnZhbCBpcyBzcGVjaWZpZWQgd2UgaWdub3JlIHByZXNldFxuICAgICAgICBpZihvcHRpb25zICYmIChvcHRpb25zLm1pbiB8fCBvcHRpb25zLm1heCkpIHtcbiAgICAgICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgYW1lcmljYW46IHRydWUsXG4gICAgICAgICAgICAgICAgc3RyaW5nOiBmYWxzZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB2YXIgbWluID0gdHlwZW9mIG9wdGlvbnMubWluICE9PSBcInVuZGVmaW5lZFwiID8gb3B0aW9ucy5taW4uZ2V0VGltZSgpIDogMTtcbiAgICAgICAgICAgIC8vIDEwMCwwMDAsMDAwIGRheXMgbWVhc3VyZWQgcmVsYXRpdmUgdG8gbWlkbmlnaHQgYXQgdGhlIGJlZ2lubmluZyBvZiAwMSBKYW51YXJ5LCAxOTcwIFVUQy4gaHR0cDovL2VzNS5naXRodWIuaW8vI3gxNS45LjEuMVxuICAgICAgICAgICAgdmFyIG1heCA9IHR5cGVvZiBvcHRpb25zLm1heCAhPT0gXCJ1bmRlZmluZWRcIiA/IG9wdGlvbnMubWF4LmdldFRpbWUoKSA6IDg2NDAwMDAwMDAwMDAwMDA7XG5cbiAgICAgICAgICAgIGRhdGUgPSBuZXcgRGF0ZSh0aGlzLm5hdHVyYWwoe21pbjogbWluLCBtYXg6IG1heH0pKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHZhciBtID0gdGhpcy5tb250aCh7cmF3OiB0cnVlfSk7XG4gICAgICAgICAgICB2YXIgZGF5c0luTW9udGggPSBtLmRheXM7XG5cbiAgICAgICAgICAgIGlmKG9wdGlvbnMgJiYgb3B0aW9ucy5tb250aCkge1xuICAgICAgICAgICAgICAgIC8vIE1vZCAxMiB0byBhbGxvdyBtb250aHMgb3V0c2lkZSByYW5nZSBvZiAwLTExIChub3QgZW5jb3VyYWdlZCwgYnV0IGFsc28gbm90IHByZXZlbnRlZCkuXG4gICAgICAgICAgICAgICAgZGF5c0luTW9udGggPSB0aGlzLmdldCgnbW9udGhzJylbKChvcHRpb25zLm1vbnRoICUgMTIpICsgMTIpICUgMTJdLmRheXM7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7XG4gICAgICAgICAgICAgICAgeWVhcjogcGFyc2VJbnQodGhpcy55ZWFyKCksIDEwKSxcbiAgICAgICAgICAgICAgICAvLyBOZWNlc3NhcnkgdG8gc3VidHJhY3QgMSBiZWNhdXNlIERhdGUoKSAwLWluZGV4ZXMgbW9udGggYnV0IG5vdCBkYXkgb3IgeWVhclxuICAgICAgICAgICAgICAgIC8vIGZvciBzb21lIHJlYXNvbi5cbiAgICAgICAgICAgICAgICBtb250aDogbS5udW1lcmljIC0gMSxcbiAgICAgICAgICAgICAgICBkYXk6IHRoaXMubmF0dXJhbCh7bWluOiAxLCBtYXg6IGRheXNJbk1vbnRofSksXG4gICAgICAgICAgICAgICAgaG91cjogdGhpcy5ob3VyKCksXG4gICAgICAgICAgICAgICAgbWludXRlOiB0aGlzLm1pbnV0ZSgpLFxuICAgICAgICAgICAgICAgIHNlY29uZDogdGhpcy5zZWNvbmQoKSxcbiAgICAgICAgICAgICAgICBtaWxsaXNlY29uZDogdGhpcy5taWxsaXNlY29uZCgpLFxuICAgICAgICAgICAgICAgIGFtZXJpY2FuOiB0cnVlLFxuICAgICAgICAgICAgICAgIHN0cmluZzogZmFsc2VcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICBkYXRlID0gbmV3IERhdGUob3B0aW9ucy55ZWFyLCBvcHRpb25zLm1vbnRoLCBvcHRpb25zLmRheSwgb3B0aW9ucy5ob3VyLCBvcHRpb25zLm1pbnV0ZSwgb3B0aW9ucy5zZWNvbmQsIG9wdGlvbnMubWlsbGlzZWNvbmQpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9wdGlvbnMuYW1lcmljYW4pIHtcbiAgICAgICAgICAgIC8vIEFkZGluZyAxIHRvIHRoZSBtb250aCBpcyBuZWNlc3NhcnkgYmVjYXVzZSBEYXRlKCkgMC1pbmRleGVzXG4gICAgICAgICAgICAvLyBtb250aHMgYnV0IG5vdCBkYXkgZm9yIHNvbWUgb2RkIHJlYXNvbi5cbiAgICAgICAgICAgIGRhdGVfc3RyaW5nID0gKGRhdGUuZ2V0TW9udGgoKSArIDEpICsgJy8nICsgZGF0ZS5nZXREYXRlKCkgKyAnLycgKyBkYXRlLmdldEZ1bGxZZWFyKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkYXRlX3N0cmluZyA9IGRhdGUuZ2V0RGF0ZSgpICsgJy8nICsgKGRhdGUuZ2V0TW9udGgoKSArIDEpICsgJy8nICsgZGF0ZS5nZXRGdWxsWWVhcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG9wdGlvbnMuc3RyaW5nID8gZGF0ZV9zdHJpbmcgOiBkYXRlO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmhhbW1lcnRpbWUgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRlKG9wdGlvbnMpLmdldFRpbWUoKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5ob3VyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHttaW46IDEsIG1heDogb3B0aW9ucyAmJiBvcHRpb25zLnR3ZW50eWZvdXIgPyAyNCA6IDEyfSk7XG5cbiAgICAgICAgdGVzdFJhbmdlKG9wdGlvbnMubWluIDwgMSwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgbGVzcyB0aGFuIDEuXCIpO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy50d2VudHlmb3VyICYmIG9wdGlvbnMubWF4ID4gMjQsIFwiQ2hhbmNlOiBNYXggY2Fubm90IGJlIGdyZWF0ZXIgdGhhbiAyNCBmb3IgdHdlbnR5Zm91ciBvcHRpb24uXCIpO1xuICAgICAgICB0ZXN0UmFuZ2UoIW9wdGlvbnMudHdlbnR5Zm91ciAmJiBvcHRpb25zLm1heCA+IDEyLCBcIkNoYW5jZTogTWF4IGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gMTIuXCIpO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPiBvcHRpb25zLm1heCwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIE1heC5cIik7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbCh7bWluOiBvcHRpb25zLm1pbiwgbWF4OiBvcHRpb25zLm1heH0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm1pbGxpc2Vjb25kID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHttYXg6IDk5OX0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm1pbnV0ZSA9IENoYW5jZS5wcm90b3R5cGUuc2Vjb25kID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHttaW46IDAsIG1heDogNTl9KTtcblxuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPCAwLCBcIkNoYW5jZTogTWluIGNhbm5vdCBiZSBsZXNzIHRoYW4gMC5cIik7XG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLm1heCA+IDU5LCBcIkNoYW5jZTogTWF4IGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gNTkuXCIpO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPiBvcHRpb25zLm1heCwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIE1heC5cIik7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbCh7bWluOiBvcHRpb25zLm1pbiwgbWF4OiBvcHRpb25zLm1heH0pO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLm1vbnRoID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHttaW46IDEsIG1heDogMTJ9KTtcblxuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPCAxLCBcIkNoYW5jZTogTWluIGNhbm5vdCBiZSBsZXNzIHRoYW4gMS5cIik7XG4gICAgICAgIHRlc3RSYW5nZShvcHRpb25zLm1heCA+IDEyLCBcIkNoYW5jZTogTWF4IGNhbm5vdCBiZSBncmVhdGVyIHRoYW4gMTIuXCIpO1xuICAgICAgICB0ZXN0UmFuZ2Uob3B0aW9ucy5taW4gPiBvcHRpb25zLm1heCwgXCJDaGFuY2U6IE1pbiBjYW5ub3QgYmUgZ3JlYXRlciB0aGFuIE1heC5cIik7XG5cbiAgICAgICAgdmFyIG1vbnRoID0gdGhpcy5waWNrKHRoaXMubW9udGhzKCkuc2xpY2Uob3B0aW9ucy5taW4gLSAxLCBvcHRpb25zLm1heCkpO1xuICAgICAgICByZXR1cm4gb3B0aW9ucy5yYXcgPyBtb250aCA6IG1vbnRoLm5hbWU7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubW9udGhzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZXQoXCJtb250aHNcIik7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuc2Vjb25kID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHttYXg6IDU5fSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUudGltZXN0YW1wID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogcGFyc2VJbnQobmV3IERhdGUoKS5nZXRUaW1lKCkgLyAxMDAwLCAxMCl9KTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS55ZWFyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgLy8gRGVmYXVsdCB0byBjdXJyZW50IHllYXIgYXMgbWluIGlmIG5vbmUgc3BlY2lmaWVkXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bWluOiBuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCl9KTtcblxuICAgICAgICAvLyBEZWZhdWx0IHRvIG9uZSBjZW50dXJ5IGFmdGVyIGN1cnJlbnQgeWVhciBhcyBtYXggaWYgbm9uZSBzcGVjaWZpZWRcbiAgICAgICAgb3B0aW9ucy5tYXggPSAodHlwZW9mIG9wdGlvbnMubWF4ICE9PSBcInVuZGVmaW5lZFwiKSA/IG9wdGlvbnMubWF4IDogb3B0aW9ucy5taW4gKyAxMDA7XG5cbiAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbChvcHRpb25zKS50b1N0cmluZygpO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgVGltZVxuXG4gICAgLy8gLS0gRmluYW5jZSAtLVxuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5jYyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcblxuICAgICAgICB2YXIgdHlwZSwgbnVtYmVyLCB0b19nZW5lcmF0ZTtcblxuICAgICAgICB0eXBlID0gKG9wdGlvbnMudHlwZSkgP1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmNjX3R5cGUoeyBuYW1lOiBvcHRpb25zLnR5cGUsIHJhdzogdHJ1ZSB9KSA6XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuY2NfdHlwZSh7IHJhdzogdHJ1ZSB9KTtcblxuICAgICAgICBudW1iZXIgPSB0eXBlLnByZWZpeC5zcGxpdChcIlwiKTtcbiAgICAgICAgdG9fZ2VuZXJhdGUgPSB0eXBlLmxlbmd0aCAtIHR5cGUucHJlZml4Lmxlbmd0aCAtIDE7XG5cbiAgICAgICAgLy8gR2VuZXJhdGVzIG4gLSAxIGRpZ2l0c1xuICAgICAgICBudW1iZXIgPSBudW1iZXIuY29uY2F0KHRoaXMubih0aGlzLmludGVnZXIsIHRvX2dlbmVyYXRlLCB7bWluOiAwLCBtYXg6IDl9KSk7XG5cbiAgICAgICAgLy8gR2VuZXJhdGVzIHRoZSBsYXN0IGRpZ2l0IGFjY29yZGluZyB0byBMdWhuIGFsZ29yaXRobVxuICAgICAgICBudW1iZXIucHVzaCh0aGlzLmx1aG5fY2FsY3VsYXRlKG51bWJlci5qb2luKFwiXCIpKSk7XG5cbiAgICAgICAgcmV0dXJuIG51bWJlci5qb2luKFwiXCIpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmNjX3R5cGVzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0JhbmtfY2FyZF9udW1iZXIjSXNzdWVyX2lkZW50aWZpY2F0aW9uX251bWJlcl8uMjhJSU4uMjlcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2V0KFwiY2NfdHlwZXNcIik7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuY2NfdHlwZSA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgdmFyIHR5cGVzID0gdGhpcy5jY190eXBlcygpLFxuICAgICAgICAgICAgdHlwZSA9IG51bGw7XG5cbiAgICAgICAgaWYgKG9wdGlvbnMubmFtZSkge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0eXBlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIC8vIEFjY2VwdCBlaXRoZXIgbmFtZSBvciBzaG9ydF9uYW1lIHRvIHNwZWNpZnkgY2FyZCB0eXBlXG4gICAgICAgICAgICAgICAgaWYgKHR5cGVzW2ldLm5hbWUgPT09IG9wdGlvbnMubmFtZSB8fCB0eXBlc1tpXS5zaG9ydF9uYW1lID09PSBvcHRpb25zLm5hbWUpIHtcbiAgICAgICAgICAgICAgICAgICAgdHlwZSA9IHR5cGVzW2ldO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBSYW5nZUVycm9yKFwiQ3JlZGl0IGNhcmQgdHlwZSAnXCIgKyBvcHRpb25zLm5hbWUgKyBcIicnIGlzIG5vdCBzdXBwb3J0ZWRcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0eXBlID0gdGhpcy5waWNrKHR5cGVzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBvcHRpb25zLnJhdyA/IHR5cGUgOiB0eXBlLm5hbWU7XG4gICAgfTtcblxuICAgIC8vcmV0dXJuIGFsbCB3b3JsZCBjdXJyZW5jeSBieSBJU08gNDIxN1xuICAgIENoYW5jZS5wcm90b3R5cGUuY3VycmVuY3lfdHlwZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmdldChcImN1cnJlbmN5X3R5cGVzXCIpO1xuICAgIH07XG5cbiAgICAvL3JldHVybiByYW5kb20gd29ybGQgY3VycmVuY3kgYnkgSVNPIDQyMTdcbiAgICBDaGFuY2UucHJvdG90eXBlLmN1cnJlbmN5ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5waWNrKHRoaXMuY3VycmVuY3lfdHlwZXMoKSk7XG4gICAgfTtcblxuICAgIC8vUmV0dXJuIHJhbmRvbSBjb3JyZWN0IGN1cnJlbmN5IGV4Y2hhbmdlIHBhaXIgKGUuZy4gRVVSL1VTRCkgb3IgYXJyYXkgb2YgY3VycmVuY3kgY29kZVxuICAgIENoYW5jZS5wcm90b3R5cGUuY3VycmVuY3lfcGFpciA9IGZ1bmN0aW9uIChyZXR1cm5Bc1N0cmluZykge1xuICAgICAgICB2YXIgY3VycmVuY2llcyA9IHRoaXMudW5pcXVlKHRoaXMuY3VycmVuY3ksIDIsIHtcbiAgICAgICAgICAgIGNvbXBhcmF0b3I6IGZ1bmN0aW9uKGFyciwgdmFsKSB7XG5cbiAgICAgICAgICAgICAgICByZXR1cm4gYXJyLnJlZHVjZShmdW5jdGlvbihhY2MsIGl0ZW0pIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgYSBtYXRjaCBoYXMgYmVlbiBmb3VuZCwgc2hvcnQgY2lyY3VpdCBjaGVjayBhbmQganVzdCByZXR1cm5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGFjYyB8fCAoaXRlbS5jb2RlID09PSB2YWwuY29kZSk7XG4gICAgICAgICAgICAgICAgfSwgZmFsc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcblxuICAgICAgICBpZiAocmV0dXJuQXNTdHJpbmcpIHtcbiAgICAgICAgICAgIHJldHVybiBjdXJyZW5jaWVzWzBdLmNvZGUgKyAnLycgKyBjdXJyZW5jaWVzWzFdLmNvZGU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gY3VycmVuY2llcztcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmRvbGxhciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIC8vIEJ5IGRlZmF1bHQsIGEgc29tZXdoYXQgbW9yZSBzYW5lIG1heCBmb3IgZG9sbGFyIHRoYW4gYWxsIGF2YWlsYWJsZSBudW1iZXJzXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zLCB7bWF4IDogMTAwMDAsIG1pbiA6IDB9KTtcblxuICAgICAgICB2YXIgZG9sbGFyID0gdGhpcy5mbG9hdGluZyh7bWluOiBvcHRpb25zLm1pbiwgbWF4OiBvcHRpb25zLm1heCwgZml4ZWQ6IDJ9KS50b1N0cmluZygpLFxuICAgICAgICAgICAgY2VudHMgPSBkb2xsYXIuc3BsaXQoJy4nKVsxXTtcblxuICAgICAgICBpZiAoY2VudHMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgZG9sbGFyICs9ICcuMDAnO1xuICAgICAgICB9IGVsc2UgaWYgKGNlbnRzLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgIGRvbGxhciA9IGRvbGxhciArICcwJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChkb2xsYXIgPCAwKSB7XG4gICAgICAgICAgICByZXR1cm4gJy0kJyArIGRvbGxhci5yZXBsYWNlKCctJywgJycpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuICckJyArIGRvbGxhcjtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmV4cCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgdmFyIGV4cCA9IHt9O1xuXG4gICAgICAgIGV4cC55ZWFyID0gdGhpcy5leHBfeWVhcigpO1xuXG4gICAgICAgIC8vIElmIHRoZSB5ZWFyIGlzIHRoaXMgeWVhciwgbmVlZCB0byBlbnN1cmUgbW9udGggaXMgZ3JlYXRlciB0aGFuIHRoZVxuICAgICAgICAvLyBjdXJyZW50IG1vbnRoIG9yIHRoaXMgZXhwaXJhdGlvbiB3aWxsIG5vdCBiZSB2YWxpZFxuICAgICAgICBpZiAoZXhwLnllYXIgPT09IChuZXcgRGF0ZSgpLmdldEZ1bGxZZWFyKCkpLnRvU3RyaW5nKCkpIHtcbiAgICAgICAgICAgIGV4cC5tb250aCA9IHRoaXMuZXhwX21vbnRoKHtmdXR1cmU6IHRydWV9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4cC5tb250aCA9IHRoaXMuZXhwX21vbnRoKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gb3B0aW9ucy5yYXcgPyBleHAgOiBleHAubW9udGggKyAnLycgKyBleHAueWVhcjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5leHBfbW9udGggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHZhciBtb250aCwgbW9udGhfaW50LFxuICAgICAgICAgICAgLy8gRGF0ZSBvYmplY3QgbW9udGhzIGFyZSAwIGluZGV4ZWRcbiAgICAgICAgICAgIGN1ck1vbnRoID0gbmV3IERhdGUoKS5nZXRNb250aCgpICsgMTtcblxuICAgICAgICBpZiAob3B0aW9ucy5mdXR1cmUpIHtcbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgICBtb250aCA9IHRoaXMubW9udGgoe3JhdzogdHJ1ZX0pLm51bWVyaWM7XG4gICAgICAgICAgICAgICAgbW9udGhfaW50ID0gcGFyc2VJbnQobW9udGgsIDEwKTtcbiAgICAgICAgICAgIH0gd2hpbGUgKG1vbnRoX2ludCA8PSBjdXJNb250aCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBtb250aCA9IHRoaXMubW9udGgoe3JhdzogdHJ1ZX0pLm51bWVyaWM7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gbW9udGg7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUuZXhwX3llYXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnllYXIoe21heDogbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpICsgMTB9KTtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIEZpbmFuY2VcblxuICAgIC8vIC0tIFJlZ2lvbmFsXG5cbiAgICBDaGFuY2UucHJvdG90eXBlLnBsX3Blc2VsID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbnVtYmVyID0gdGhpcy5uYXR1cmFsKHttaW46IDEsIG1heDogOTk5OTk5OTk5OX0pO1xuICAgICAgICB2YXIgYXJyID0gdGhpcy5wYWQobnVtYmVyLCAxMCkuc3BsaXQoJycpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJyW2ldID0gcGFyc2VJbnQoYXJyW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjb250cm9sTnVtYmVyID0gKDEgKiBhcnJbMF0gKyAzICogYXJyWzFdICsgNyAqIGFyclsyXSArIDkgKiBhcnJbM10gKyAxICogYXJyWzRdICsgMyAqIGFycls1XSArIDcgKiBhcnJbNl0gKyA5ICogYXJyWzddICsgMSAqIGFycls4XSArIDMgKiBhcnJbOV0pICUgMTA7XG4gICAgICAgIGlmKGNvbnRyb2xOdW1iZXIgIT09IDApIHtcbiAgICAgICAgICAgIGNvbnRyb2xOdW1iZXIgPSAxMCAtIGNvbnRyb2xOdW1iZXI7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYXJyLmpvaW4oJycpICsgY29udHJvbE51bWJlcjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5wbF9uaXAgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBudW1iZXIgPSB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiA5OTk5OTk5OTl9KTtcbiAgICAgICAgdmFyIGFyciA9IHRoaXMucGFkKG51bWJlciwgOSkuc3BsaXQoJycpO1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyci5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJyW2ldID0gcGFyc2VJbnQoYXJyW2ldKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBjb250cm9sTnVtYmVyID0gKDYgKiBhcnJbMF0gKyA1ICogYXJyWzFdICsgNyAqIGFyclsyXSArIDIgKiBhcnJbM10gKyAzICogYXJyWzRdICsgNCAqIGFycls1XSArIDUgKiBhcnJbNl0gKyA2ICogYXJyWzddICsgNyAqIGFycls4XSkgJSAxMTtcbiAgICAgICAgaWYoY29udHJvbE51bWJlciA9PT0gMTApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnBsX25pcCgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFyci5qb2luKCcnKSArIGNvbnRyb2xOdW1iZXI7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucGxfcmVnb24gPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBudW1iZXIgPSB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiA5OTk5OTk5OX0pO1xuICAgICAgICB2YXIgYXJyID0gdGhpcy5wYWQobnVtYmVyLCA4KS5zcGxpdCgnJyk7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYXJyLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBhcnJbaV0gPSBwYXJzZUludChhcnJbaV0pO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNvbnRyb2xOdW1iZXIgPSAoOCAqIGFyclswXSArIDkgKiBhcnJbMV0gKyAyICogYXJyWzJdICsgMyAqIGFyclszXSArIDQgKiBhcnJbNF0gKyA1ICogYXJyWzVdICsgNiAqIGFycls2XSArIDcgKiBhcnJbN10pICUgMTE7XG4gICAgICAgIGlmKGNvbnRyb2xOdW1iZXIgPT09IDEwKSB7XG4gICAgICAgICAgICBjb250cm9sTnVtYmVyID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBhcnIuam9pbignJykgKyBjb250cm9sTnVtYmVyO1xuICAgIH07XG5cbiAgICAvLyAtLSBFbmQgUmVnaW9uYWxcblxuICAgIC8vIC0tIE1pc2NlbGxhbmVvdXMgLS1cblxuICAgIC8vIERpY2UgLSBGb3IgYWxsIHRoZSBib2FyZCBnYW1lIGdlZWtzIG91dCB0aGVyZSwgbXlzZWxmIGluY2x1ZGVkIDspXG4gICAgZnVuY3Rpb24gZGljZUZuIChyYW5nZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubmF0dXJhbChyYW5nZSk7XG4gICAgICAgIH07XG4gICAgfVxuICAgIENoYW5jZS5wcm90b3R5cGUuZDQgPSBkaWNlRm4oe21pbjogMSwgbWF4OiA0fSk7XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kNiA9IGRpY2VGbih7bWluOiAxLCBtYXg6IDZ9KTtcbiAgICBDaGFuY2UucHJvdG90eXBlLmQ4ID0gZGljZUZuKHttaW46IDEsIG1heDogOH0pO1xuICAgIENoYW5jZS5wcm90b3R5cGUuZDEwID0gZGljZUZuKHttaW46IDEsIG1heDogMTB9KTtcbiAgICBDaGFuY2UucHJvdG90eXBlLmQxMiA9IGRpY2VGbih7bWluOiAxLCBtYXg6IDEyfSk7XG4gICAgQ2hhbmNlLnByb3RvdHlwZS5kMjAgPSBkaWNlRm4oe21pbjogMSwgbWF4OiAyMH0pO1xuICAgIENoYW5jZS5wcm90b3R5cGUuZDMwID0gZGljZUZuKHttaW46IDEsIG1heDogMzB9KTtcbiAgICBDaGFuY2UucHJvdG90eXBlLmQxMDAgPSBkaWNlRm4oe21pbjogMSwgbWF4OiAxMDB9KTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUucnBnID0gZnVuY3Rpb24gKHRocm93biwgb3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIGlmICghdGhyb3duKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgUmFuZ2VFcnJvcihcIkEgdHlwZSBvZiBkaWUgcm9sbCBtdXN0IGJlIGluY2x1ZGVkXCIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIGJpdHMgPSB0aHJvd24udG9Mb3dlckNhc2UoKS5zcGxpdChcImRcIiksXG4gICAgICAgICAgICAgICAgcm9sbHMgPSBbXTtcblxuICAgICAgICAgICAgaWYgKGJpdHMubGVuZ3RoICE9PSAyIHx8ICFwYXJzZUludChiaXRzWzBdLCAxMCkgfHwgIXBhcnNlSW50KGJpdHNbMV0sIDEwKSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgZm9ybWF0IHByb3ZpZGVkLiBQbGVhc2UgcHJvdmlkZSAjZCMgd2hlcmUgdGhlIGZpcnN0ICMgaXMgdGhlIG51bWJlciBvZiBkaWNlIHRvIHJvbGwsIHRoZSBzZWNvbmQgIyBpcyB0aGUgbWF4IG9mIGVhY2ggZGllXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IGJpdHNbMF07IGkgPiAwOyBpLS0pIHtcbiAgICAgICAgICAgICAgICByb2xsc1tpIC0gMV0gPSB0aGlzLm5hdHVyYWwoe21pbjogMSwgbWF4OiBiaXRzWzFdfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gKHR5cGVvZiBvcHRpb25zLnN1bSAhPT0gJ3VuZGVmaW5lZCcgJiYgb3B0aW9ucy5zdW0pID8gcm9sbHMucmVkdWNlKGZ1bmN0aW9uIChwLCBjKSB7IHJldHVybiBwICsgYzsgfSkgOiByb2xscztcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBHdWlkXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5ndWlkID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHsgdmVyc2lvbjogNSB9KTtcblxuICAgICAgICB2YXIgZ3VpZF9wb29sID0gXCJhYmNkZWYxMjM0NTY3ODkwXCIsXG4gICAgICAgICAgICB2YXJpYW50X3Bvb2wgPSBcImFiODlcIixcbiAgICAgICAgICAgIGd1aWQgPSB0aGlzLnN0cmluZyh7IHBvb2w6IGd1aWRfcG9vbCwgbGVuZ3RoOiA4IH0pICsgJy0nICtcbiAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmluZyh7IHBvb2w6IGd1aWRfcG9vbCwgbGVuZ3RoOiA0IH0pICsgJy0nICtcbiAgICAgICAgICAgICAgICAgICAvLyBUaGUgVmVyc2lvblxuICAgICAgICAgICAgICAgICAgIG9wdGlvbnMudmVyc2lvbiArXG4gICAgICAgICAgICAgICAgICAgdGhpcy5zdHJpbmcoeyBwb29sOiBndWlkX3Bvb2wsIGxlbmd0aDogMyB9KSArICctJyArXG4gICAgICAgICAgICAgICAgICAgLy8gVGhlIFZhcmlhbnRcbiAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmluZyh7IHBvb2w6IHZhcmlhbnRfcG9vbCwgbGVuZ3RoOiAxIH0pICtcbiAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmluZyh7IHBvb2w6IGd1aWRfcG9vbCwgbGVuZ3RoOiAzIH0pICsgJy0nICtcbiAgICAgICAgICAgICAgICAgICB0aGlzLnN0cmluZyh7IHBvb2w6IGd1aWRfcG9vbCwgbGVuZ3RoOiAxMiB9KTtcbiAgICAgICAgcmV0dXJuIGd1aWQ7XG4gICAgfTtcblxuICAgIC8vIEhhc2hcbiAgICBDaGFuY2UucHJvdG90eXBlLmhhc2ggPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge2xlbmd0aCA6IDQwLCBjYXNpbmc6ICdsb3dlcid9KTtcbiAgICAgICAgdmFyIHBvb2wgPSBvcHRpb25zLmNhc2luZyA9PT0gJ3VwcGVyJyA/IEhFWF9QT09MLnRvVXBwZXJDYXNlKCkgOiBIRVhfUE9PTDtcbiAgICAgICAgcmV0dXJuIHRoaXMuc3RyaW5nKHtwb29sOiBwb29sLCBsZW5ndGg6IG9wdGlvbnMubGVuZ3RofSk7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubHVobl9jaGVjayA9IGZ1bmN0aW9uIChudW0pIHtcbiAgICAgICAgdmFyIHN0ciA9IG51bS50b1N0cmluZygpO1xuICAgICAgICB2YXIgY2hlY2tEaWdpdCA9ICtzdHIuc3Vic3RyaW5nKHN0ci5sZW5ndGggLSAxKTtcbiAgICAgICAgcmV0dXJuIGNoZWNrRGlnaXQgPT09IHRoaXMubHVobl9jYWxjdWxhdGUoK3N0ci5zdWJzdHJpbmcoMCwgc3RyLmxlbmd0aCAtIDEpKTtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5sdWhuX2NhbGN1bGF0ZSA9IGZ1bmN0aW9uIChudW0pIHtcbiAgICAgICAgdmFyIGRpZ2l0cyA9IG51bS50b1N0cmluZygpLnNwbGl0KFwiXCIpLnJldmVyc2UoKTtcbiAgICAgICAgdmFyIHN1bSA9IDA7XG4gICAgICAgIHZhciBkaWdpdDtcblxuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGRpZ2l0cy5sZW5ndGg7IGwgPiBpOyArK2kpIHtcbiAgICAgICAgICAgIGRpZ2l0ID0gK2RpZ2l0c1tpXTtcbiAgICAgICAgICAgIGlmIChpICUgMiA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGRpZ2l0ICo9IDI7XG4gICAgICAgICAgICAgICAgaWYgKGRpZ2l0ID4gOSkge1xuICAgICAgICAgICAgICAgICAgICBkaWdpdCAtPSA5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHN1bSArPSBkaWdpdDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gKHN1bSAqIDkpICUgMTA7XG4gICAgfTtcblxuICAgIC8vIE1ENSBIYXNoXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5tZDUgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gICAgICAgIHZhciBvcHRzID0geyBzdHI6ICcnLCBrZXk6IG51bGwsIHJhdzogZmFsc2UgfTtcblxuICAgICAgICBpZiAoIW9wdGlvbnMpIHtcbiAgICAgICAgICAgIG9wdHMuc3RyID0gdGhpcy5zdHJpbmcoKTtcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIG9wdHMuc3RyID0gb3B0aW9ucztcbiAgICAgICAgICAgIG9wdGlvbnMgPSB7fTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIGlmICh0eXBlb2Ygb3B0aW9ucyAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYob3B0aW9ucy5jb25zdHJ1Y3RvciA9PT0gJ0FycmF5Jykge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBvcHRzID0gaW5pdE9wdGlvbnMob3B0aW9ucywgb3B0cyk7XG5cbiAgICAgICAgaWYoIW9wdHMuc3RyKXtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQSBwYXJhbWV0ZXIgaXMgcmVxdWlyZWQgdG8gcmV0dXJuIGFuIG1kNSBoYXNoLicpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuYmltZDUubWQ1KG9wdHMuc3RyLCBvcHRzLmtleSwgb3B0cy5yYXcpO1xuICAgIH07XG5cbiAgICB2YXIgZGF0YSA9IHtcblxuICAgICAgICBmaXJzdE5hbWVzOiB7XG4gICAgICAgICAgICBcIm1hbGVcIjogW1wiSmFtZXNcIiwgXCJKb2huXCIsIFwiUm9iZXJ0XCIsIFwiTWljaGFlbFwiLCBcIldpbGxpYW1cIiwgXCJEYXZpZFwiLCBcIlJpY2hhcmRcIiwgXCJKb3NlcGhcIiwgXCJDaGFybGVzXCIsIFwiVGhvbWFzXCIsIFwiQ2hyaXN0b3BoZXJcIiwgXCJEYW5pZWxcIiwgXCJNYXR0aGV3XCIsIFwiR2VvcmdlXCIsIFwiRG9uYWxkXCIsIFwiQW50aG9ueVwiLCBcIlBhdWxcIiwgXCJNYXJrXCIsIFwiRWR3YXJkXCIsIFwiU3RldmVuXCIsIFwiS2VubmV0aFwiLCBcIkFuZHJld1wiLCBcIkJyaWFuXCIsIFwiSm9zaHVhXCIsIFwiS2V2aW5cIiwgXCJSb25hbGRcIiwgXCJUaW1vdGh5XCIsIFwiSmFzb25cIiwgXCJKZWZmcmV5XCIsIFwiRnJhbmtcIiwgXCJHYXJ5XCIsIFwiUnlhblwiLCBcIk5pY2hvbGFzXCIsIFwiRXJpY1wiLCBcIlN0ZXBoZW5cIiwgXCJKYWNvYlwiLCBcIkxhcnJ5XCIsIFwiSm9uYXRoYW5cIiwgXCJTY290dFwiLCBcIlJheW1vbmRcIiwgXCJKdXN0aW5cIiwgXCJCcmFuZG9uXCIsIFwiR3JlZ29yeVwiLCBcIlNhbXVlbFwiLCBcIkJlbmphbWluXCIsIFwiUGF0cmlja1wiLCBcIkphY2tcIiwgXCJIZW5yeVwiLCBcIldhbHRlclwiLCBcIkRlbm5pc1wiLCBcIkplcnJ5XCIsIFwiQWxleGFuZGVyXCIsIFwiUGV0ZXJcIiwgXCJUeWxlclwiLCBcIkRvdWdsYXNcIiwgXCJIYXJvbGRcIiwgXCJBYXJvblwiLCBcIkpvc2VcIiwgXCJBZGFtXCIsIFwiQXJ0aHVyXCIsIFwiWmFjaGFyeVwiLCBcIkNhcmxcIiwgXCJOYXRoYW5cIiwgXCJBbGJlcnRcIiwgXCJLeWxlXCIsIFwiTGF3cmVuY2VcIiwgXCJKb2VcIiwgXCJXaWxsaWVcIiwgXCJHZXJhbGRcIiwgXCJSb2dlclwiLCBcIktlaXRoXCIsIFwiSmVyZW15XCIsIFwiVGVycnlcIiwgXCJIYXJyeVwiLCBcIlJhbHBoXCIsIFwiU2VhblwiLCBcIkplc3NlXCIsIFwiUm95XCIsIFwiTG91aXNcIiwgXCJCaWxseVwiLCBcIkF1c3RpblwiLCBcIkJydWNlXCIsIFwiRXVnZW5lXCIsIFwiQ2hyaXN0aWFuXCIsIFwiQnJ5YW5cIiwgXCJXYXluZVwiLCBcIlJ1c3NlbGxcIiwgXCJIb3dhcmRcIiwgXCJGcmVkXCIsIFwiRXRoYW5cIiwgXCJKb3JkYW5cIiwgXCJQaGlsaXBcIiwgXCJBbGFuXCIsIFwiSnVhblwiLCBcIlJhbmR5XCIsIFwiVmluY2VudFwiLCBcIkJvYmJ5XCIsIFwiRHlsYW5cIiwgXCJKb2hubnlcIiwgXCJQaGlsbGlwXCIsIFwiVmljdG9yXCIsIFwiQ2xhcmVuY2VcIiwgXCJFcm5lc3RcIiwgXCJNYXJ0aW5cIiwgXCJDcmFpZ1wiLCBcIlN0YW5sZXlcIiwgXCJTaGF3blwiLCBcIlRyYXZpc1wiLCBcIkJyYWRsZXlcIiwgXCJMZW9uYXJkXCIsIFwiRWFybFwiLCBcIkdhYnJpZWxcIiwgXCJKaW1teVwiLCBcIkZyYW5jaXNcIiwgXCJUb2RkXCIsIFwiTm9haFwiLCBcIkRhbm55XCIsIFwiRGFsZVwiLCBcIkNvZHlcIiwgXCJDYXJsb3NcIiwgXCJBbGxlblwiLCBcIkZyZWRlcmlja1wiLCBcIkxvZ2FuXCIsIFwiQ3VydGlzXCIsIFwiQWxleFwiLCBcIkpvZWxcIiwgXCJMdWlzXCIsIFwiTm9ybWFuXCIsIFwiTWFydmluXCIsIFwiR2xlbm5cIiwgXCJUb255XCIsIFwiTmF0aGFuaWVsXCIsIFwiUm9kbmV5XCIsIFwiTWVsdmluXCIsIFwiQWxmcmVkXCIsIFwiU3RldmVcIiwgXCJDYW1lcm9uXCIsIFwiQ2hhZFwiLCBcIkVkd2luXCIsIFwiQ2FsZWJcIiwgXCJFdmFuXCIsIFwiQW50b25pb1wiLCBcIkxlZVwiLCBcIkhlcmJlcnRcIiwgXCJKZWZmZXJ5XCIsIFwiSXNhYWNcIiwgXCJEZXJla1wiLCBcIlJpY2t5XCIsIFwiTWFyY3VzXCIsIFwiVGhlb2RvcmVcIiwgXCJFbGlqYWhcIiwgXCJMdWtlXCIsIFwiSmVzdXNcIiwgXCJFZGRpZVwiLCBcIlRyb3lcIiwgXCJNaWtlXCIsIFwiRHVzdGluXCIsIFwiUmF5XCIsIFwiQWRyaWFuXCIsIFwiQmVybmFyZFwiLCBcIkxlcm95XCIsIFwiQW5nZWxcIiwgXCJSYW5kYWxsXCIsIFwiV2VzbGV5XCIsIFwiSWFuXCIsIFwiSmFyZWRcIiwgXCJNYXNvblwiLCBcIkh1bnRlclwiLCBcIkNhbHZpblwiLCBcIk9zY2FyXCIsIFwiQ2xpZmZvcmRcIiwgXCJKYXlcIiwgXCJTaGFuZVwiLCBcIlJvbm5pZVwiLCBcIkJhcnJ5XCIsIFwiTHVjYXNcIiwgXCJDb3JleVwiLCBcIk1hbnVlbFwiLCBcIkxlb1wiLCBcIlRvbW15XCIsIFwiV2FycmVuXCIsIFwiSmFja3NvblwiLCBcIklzYWlhaFwiLCBcIkNvbm5vclwiLCBcIkRvblwiLCBcIkRlYW5cIiwgXCJKb25cIiwgXCJKdWxpYW5cIiwgXCJNaWd1ZWxcIiwgXCJCaWxsXCIsIFwiTGxveWRcIiwgXCJDaGFybGllXCIsIFwiTWl0Y2hlbGxcIiwgXCJMZW9uXCIsIFwiSmVyb21lXCIsIFwiRGFycmVsbFwiLCBcIkplcmVtaWFoXCIsIFwiQWx2aW5cIiwgXCJCcmV0dFwiLCBcIlNldGhcIiwgXCJGbG95ZFwiLCBcIkppbVwiLCBcIkJsYWtlXCIsIFwiTWljaGVhbFwiLCBcIkdvcmRvblwiLCBcIlRyZXZvclwiLCBcIkxld2lzXCIsIFwiRXJpa1wiLCBcIkVkZ2FyXCIsIFwiVmVybm9uXCIsIFwiRGV2aW5cIiwgXCJHYXZpblwiLCBcIkpheWRlblwiLCBcIkNocmlzXCIsIFwiQ2x5ZGVcIiwgXCJUb21cIiwgXCJEZXJyaWNrXCIsIFwiTWFyaW9cIiwgXCJCcmVudFwiLCBcIk1hcmNcIiwgXCJIZXJtYW5cIiwgXCJDaGFzZVwiLCBcIkRvbWluaWNcIiwgXCJSaWNhcmRvXCIsIFwiRnJhbmtsaW5cIiwgXCJNYXVyaWNlXCIsIFwiTWF4XCIsIFwiQWlkZW5cIiwgXCJPd2VuXCIsIFwiTGVzdGVyXCIsIFwiR2lsYmVydFwiLCBcIkVsbWVyXCIsIFwiR2VuZVwiLCBcIkZyYW5jaXNjb1wiLCBcIkdsZW5cIiwgXCJDb3J5XCIsIFwiR2FycmV0dFwiLCBcIkNsYXl0b25cIiwgXCJTYW1cIiwgXCJKb3JnZVwiLCBcIkNoZXN0ZXJcIiwgXCJBbGVqYW5kcm9cIiwgXCJKZWZmXCIsIFwiSGFydmV5XCIsIFwiTWlsdG9uXCIsIFwiQ29sZVwiLCBcIkl2YW5cIiwgXCJBbmRyZVwiLCBcIkR1YW5lXCIsIFwiTGFuZG9uXCJdLFxuICAgICAgICAgICAgXCJmZW1hbGVcIjogW1wiTWFyeVwiLCBcIkVtbWFcIiwgXCJFbGl6YWJldGhcIiwgXCJNaW5uaWVcIiwgXCJNYXJnYXJldFwiLCBcIklkYVwiLCBcIkFsaWNlXCIsIFwiQmVydGhhXCIsIFwiU2FyYWhcIiwgXCJBbm5pZVwiLCBcIkNsYXJhXCIsIFwiRWxsYVwiLCBcIkZsb3JlbmNlXCIsIFwiQ29yYVwiLCBcIk1hcnRoYVwiLCBcIkxhdXJhXCIsIFwiTmVsbGllXCIsIFwiR3JhY2VcIiwgXCJDYXJyaWVcIiwgXCJNYXVkZVwiLCBcIk1hYmVsXCIsIFwiQmVzc2llXCIsIFwiSmVubmllXCIsIFwiR2VydHJ1ZGVcIiwgXCJKdWxpYVwiLCBcIkhhdHRpZVwiLCBcIkVkaXRoXCIsIFwiTWF0dGllXCIsIFwiUm9zZVwiLCBcIkNhdGhlcmluZVwiLCBcIkxpbGxpYW5cIiwgXCJBZGFcIiwgXCJMaWxsaWVcIiwgXCJIZWxlblwiLCBcIkplc3NpZVwiLCBcIkxvdWlzZVwiLCBcIkV0aGVsXCIsIFwiTHVsYVwiLCBcIk15cnRsZVwiLCBcIkV2YVwiLCBcIkZyYW5jZXNcIiwgXCJMZW5hXCIsIFwiTHVjeVwiLCBcIkVkbmFcIiwgXCJNYWdnaWVcIiwgXCJQZWFybFwiLCBcIkRhaXN5XCIsIFwiRmFubmllXCIsIFwiSm9zZXBoaW5lXCIsIFwiRG9yYVwiLCBcIlJvc2FcIiwgXCJLYXRoZXJpbmVcIiwgXCJBZ25lc1wiLCBcIk1hcmllXCIsIFwiTm9yYVwiLCBcIk1heVwiLCBcIk1hbWllXCIsIFwiQmxhbmNoZVwiLCBcIlN0ZWxsYVwiLCBcIkVsbGVuXCIsIFwiTmFuY3lcIiwgXCJFZmZpZVwiLCBcIlNhbGxpZVwiLCBcIk5ldHRpZVwiLCBcIkRlbGxhXCIsIFwiTGl6emllXCIsIFwiRmxvcmFcIiwgXCJTdXNpZVwiLCBcIk1hdWRcIiwgXCJNYWVcIiwgXCJFdHRhXCIsIFwiSGFycmlldFwiLCBcIlNhZGllXCIsIFwiQ2Fyb2xpbmVcIiwgXCJLYXRpZVwiLCBcIkx5ZGlhXCIsIFwiRWxzaWVcIiwgXCJLYXRlXCIsIFwiU3VzYW5cIiwgXCJNb2xsaWVcIiwgXCJBbG1hXCIsIFwiQWRkaWVcIiwgXCJHZW9yZ2lhXCIsIFwiRWxpemFcIiwgXCJMdWx1XCIsIFwiTmFubmllXCIsIFwiTG90dGllXCIsIFwiQW1hbmRhXCIsIFwiQmVsbGVcIiwgXCJDaGFybG90dGVcIiwgXCJSZWJlY2NhXCIsIFwiUnV0aFwiLCBcIlZpb2xhXCIsIFwiT2xpdmVcIiwgXCJBbWVsaWFcIiwgXCJIYW5uYWhcIiwgXCJKYW5lXCIsIFwiVmlyZ2luaWFcIiwgXCJFbWlseVwiLCBcIk1hdGlsZGFcIiwgXCJJcmVuZVwiLCBcIkthdGhyeW5cIiwgXCJFc3RoZXJcIiwgXCJXaWxsaWVcIiwgXCJIZW5yaWV0dGFcIiwgXCJPbGxpZVwiLCBcIkFteVwiLCBcIlJhY2hlbFwiLCBcIlNhcmFcIiwgXCJFc3RlbGxhXCIsIFwiVGhlcmVzYVwiLCBcIkF1Z3VzdGFcIiwgXCJPcmFcIiwgXCJQYXVsaW5lXCIsIFwiSm9zaWVcIiwgXCJMb2xhXCIsIFwiU29waGlhXCIsIFwiTGVvbmFcIiwgXCJBbm5lXCIsIFwiTWlsZHJlZFwiLCBcIkFublwiLCBcIkJldWxhaFwiLCBcIkNhbGxpZVwiLCBcIkxvdVwiLCBcIkRlbGlhXCIsIFwiRWxlYW5vclwiLCBcIkJhcmJhcmFcIiwgXCJJdmFcIiwgXCJMb3Vpc2FcIiwgXCJNYXJpYVwiLCBcIk1heW1lXCIsIFwiRXZlbHluXCIsIFwiRXN0ZWxsZVwiLCBcIk5pbmFcIiwgXCJCZXR0eVwiLCBcIk1hcmlvblwiLCBcIkJldHRpZVwiLCBcIkRvcm90aHlcIiwgXCJMdWVsbGFcIiwgXCJJbmV6XCIsIFwiTGVsYVwiLCBcIlJvc2llXCIsIFwiQWxsaWVcIiwgXCJNaWxsaWVcIiwgXCJKYW5pZVwiLCBcIkNvcm5lbGlhXCIsIFwiVmljdG9yaWFcIiwgXCJSdWJ5XCIsIFwiV2luaWZyZWRcIiwgXCJBbHRhXCIsIFwiQ2VsaWFcIiwgXCJDaHJpc3RpbmVcIiwgXCJCZWF0cmljZVwiLCBcIkJpcmRpZVwiLCBcIkhhcnJpZXR0XCIsIFwiTWFibGVcIiwgXCJNeXJhXCIsIFwiU29waGllXCIsIFwiVGlsbGllXCIsIFwiSXNhYmVsXCIsIFwiU3lsdmlhXCIsIFwiQ2Fyb2x5blwiLCBcIklzYWJlbGxlXCIsIFwiTGVpbGFcIiwgXCJTYWxseVwiLCBcIkluYVwiLCBcIkVzc2llXCIsIFwiQmVydGllXCIsIFwiTmVsbFwiLCBcIkFsYmVydGFcIiwgXCJLYXRoYXJpbmVcIiwgXCJMb3JhXCIsIFwiUmVuYVwiLCBcIk1pbmFcIiwgXCJSaG9kYVwiLCBcIk1hdGhpbGRhXCIsIFwiQWJiaWVcIiwgXCJFdWxhXCIsIFwiRG9sbGllXCIsIFwiSGV0dGllXCIsIFwiRXVuaWNlXCIsIFwiRmFubnlcIiwgXCJPbGFcIiwgXCJMZW5vcmFcIiwgXCJBZGVsYWlkZVwiLCBcIkNocmlzdGluYVwiLCBcIkxlbGlhXCIsIFwiTmVsbGVcIiwgXCJTdWVcIiwgXCJKb2hhbm5hXCIsIFwiTGlsbHlcIiwgXCJMdWNpbmRhXCIsIFwiTWluZXJ2YVwiLCBcIkxldHRpZVwiLCBcIlJveGllXCIsIFwiQ3ludGhpYVwiLCBcIkhlbGVuYVwiLCBcIkhpbGRhXCIsIFwiSHVsZGFcIiwgXCJCZXJuaWNlXCIsIFwiR2VuZXZpZXZlXCIsIFwiSmVhblwiLCBcIkNvcmRlbGlhXCIsIFwiTWFyaWFuXCIsIFwiRnJhbmNpc1wiLCBcIkplYW5ldHRlXCIsIFwiQWRlbGluZVwiLCBcIkd1c3NpZVwiLCBcIkxlYWhcIiwgXCJMb2lzXCIsIFwiTHVyYVwiLCBcIk1pdHRpZVwiLCBcIkhhbGxpZVwiLCBcIklzYWJlbGxhXCIsIFwiT2xnYVwiLCBcIlBob2ViZVwiLCBcIlRlcmVzYVwiLCBcIkhlc3RlclwiLCBcIkxpZGFcIiwgXCJMaW5hXCIsIFwiV2lubmllXCIsIFwiQ2xhdWRpYVwiLCBcIk1hcmd1ZXJpdGVcIiwgXCJWZXJhXCIsIFwiQ2VjZWxpYVwiLCBcIkJlc3NcIiwgXCJFbWlsaWVcIiwgXCJKb2huXCIsIFwiUm9zZXR0YVwiLCBcIlZlcm5hXCIsIFwiTXlydGllXCIsIFwiQ2VjaWxpYVwiLCBcIkVsdmFcIiwgXCJPbGl2aWFcIiwgXCJPcGhlbGlhXCIsIFwiR2VvcmdpZVwiLCBcIkVsbm9yYVwiLCBcIlZpb2xldFwiLCBcIkFkZWxlXCIsIFwiTGlseVwiLCBcIkxpbm5pZVwiLCBcIkxvcmV0dGFcIiwgXCJNYWRnZVwiLCBcIlBvbGx5XCIsIFwiVmlyZ2llXCIsIFwiRXVnZW5pYVwiLCBcIkx1Y2lsZVwiLCBcIkx1Y2lsbGVcIiwgXCJNYWJlbGxlXCIsIFwiUm9zYWxpZVwiXVxuICAgICAgICB9LFxuXG4gICAgICAgIGxhc3ROYW1lczogWydTbWl0aCcsICdKb2huc29uJywgJ1dpbGxpYW1zJywgJ0pvbmVzJywgJ0Jyb3duJywgJ0RhdmlzJywgJ01pbGxlcicsICdXaWxzb24nLCAnTW9vcmUnLCAnVGF5bG9yJywgJ0FuZGVyc29uJywgJ1Rob21hcycsICdKYWNrc29uJywgJ1doaXRlJywgJ0hhcnJpcycsICdNYXJ0aW4nLCAnVGhvbXBzb24nLCAnR2FyY2lhJywgJ01hcnRpbmV6JywgJ1JvYmluc29uJywgJ0NsYXJrJywgJ1JvZHJpZ3VleicsICdMZXdpcycsICdMZWUnLCAnV2Fsa2VyJywgJ0hhbGwnLCAnQWxsZW4nLCAnWW91bmcnLCAnSGVybmFuZGV6JywgJ0tpbmcnLCAnV3JpZ2h0JywgJ0xvcGV6JywgJ0hpbGwnLCAnU2NvdHQnLCAnR3JlZW4nLCAnQWRhbXMnLCAnQmFrZXInLCAnR29uemFsZXonLCAnTmVsc29uJywgJ0NhcnRlcicsICdNaXRjaGVsbCcsICdQZXJleicsICdSb2JlcnRzJywgJ1R1cm5lcicsICdQaGlsbGlwcycsICdDYW1wYmVsbCcsICdQYXJrZXInLCAnRXZhbnMnLCAnRWR3YXJkcycsICdDb2xsaW5zJywgJ1N0ZXdhcnQnLCAnU2FuY2hleicsICdNb3JyaXMnLCAnUm9nZXJzJywgJ1JlZWQnLCAnQ29vaycsICdNb3JnYW4nLCAnQmVsbCcsICdNdXJwaHknLCAnQmFpbGV5JywgJ1JpdmVyYScsICdDb29wZXInLCAnUmljaGFyZHNvbicsICdDb3gnLCAnSG93YXJkJywgJ1dhcmQnLCAnVG9ycmVzJywgJ1BldGVyc29uJywgJ0dyYXknLCAnUmFtaXJleicsICdKYW1lcycsICdXYXRzb24nLCAnQnJvb2tzJywgJ0tlbGx5JywgJ1NhbmRlcnMnLCAnUHJpY2UnLCAnQmVubmV0dCcsICdXb29kJywgJ0Jhcm5lcycsICdSb3NzJywgJ0hlbmRlcnNvbicsICdDb2xlbWFuJywgJ0plbmtpbnMnLCAnUGVycnknLCAnUG93ZWxsJywgJ0xvbmcnLCAnUGF0dGVyc29uJywgJ0h1Z2hlcycsICdGbG9yZXMnLCAnV2FzaGluZ3RvbicsICdCdXRsZXInLCAnU2ltbW9ucycsICdGb3N0ZXInLCAnR29uemFsZXMnLCAnQnJ5YW50JywgJ0FsZXhhbmRlcicsICdSdXNzZWxsJywgJ0dyaWZmaW4nLCAnRGlheicsICdIYXllcycsICdNeWVycycsICdGb3JkJywgJ0hhbWlsdG9uJywgJ0dyYWhhbScsICdTdWxsaXZhbicsICdXYWxsYWNlJywgJ1dvb2RzJywgJ0NvbGUnLCAnV2VzdCcsICdKb3JkYW4nLCAnT3dlbnMnLCAnUmV5bm9sZHMnLCAnRmlzaGVyJywgJ0VsbGlzJywgJ0hhcnJpc29uJywgJ0dpYnNvbicsICdNY0RvbmFsZCcsICdDcnV6JywgJ01hcnNoYWxsJywgJ09ydGl6JywgJ0dvbWV6JywgJ011cnJheScsICdGcmVlbWFuJywgJ1dlbGxzJywgJ1dlYmInLCAnU2ltcHNvbicsICdTdGV2ZW5zJywgJ1R1Y2tlcicsICdQb3J0ZXInLCAnSHVudGVyJywgJ0hpY2tzJywgJ0NyYXdmb3JkJywgJ0hlbnJ5JywgJ0JveWQnLCAnTWFzb24nLCAnTW9yYWxlcycsICdLZW5uZWR5JywgJ1dhcnJlbicsICdEaXhvbicsICdSYW1vcycsICdSZXllcycsICdCdXJucycsICdHb3Jkb24nLCAnU2hhdycsICdIb2xtZXMnLCAnUmljZScsICdSb2JlcnRzb24nLCAnSHVudCcsICdCbGFjaycsICdEYW5pZWxzJywgJ1BhbG1lcicsICdNaWxscycsICdOaWNob2xzJywgJ0dyYW50JywgJ0tuaWdodCcsICdGZXJndXNvbicsICdSb3NlJywgJ1N0b25lJywgJ0hhd2tpbnMnLCAnRHVubicsICdQZXJraW5zJywgJ0h1ZHNvbicsICdTcGVuY2VyJywgJ0dhcmRuZXInLCAnU3RlcGhlbnMnLCAnUGF5bmUnLCAnUGllcmNlJywgJ0JlcnJ5JywgJ01hdHRoZXdzJywgJ0Fybm9sZCcsICdXYWduZXInLCAnV2lsbGlzJywgJ1JheScsICdXYXRraW5zJywgJ09sc29uJywgJ0NhcnJvbGwnLCAnRHVuY2FuJywgJ1NueWRlcicsICdIYXJ0JywgJ0N1bm5pbmdoYW0nLCAnQnJhZGxleScsICdMYW5lJywgJ0FuZHJld3MnLCAnUnVpeicsICdIYXJwZXInLCAnRm94JywgJ1JpbGV5JywgJ0FybXN0cm9uZycsICdDYXJwZW50ZXInLCAnV2VhdmVyJywgJ0dyZWVuZScsICdMYXdyZW5jZScsICdFbGxpb3R0JywgJ0NoYXZleicsICdTaW1zJywgJ0F1c3RpbicsICdQZXRlcnMnLCAnS2VsbGV5JywgJ0ZyYW5rbGluJywgJ0xhd3NvbicsICdGaWVsZHMnLCAnR3V0aWVycmV6JywgJ1J5YW4nLCAnU2NobWlkdCcsICdDYXJyJywgJ1Zhc3F1ZXonLCAnQ2FzdGlsbG8nLCAnV2hlZWxlcicsICdDaGFwbWFuJywgJ09saXZlcicsICdNb250Z29tZXJ5JywgJ1JpY2hhcmRzJywgJ1dpbGxpYW1zb24nLCAnSm9obnN0b24nLCAnQmFua3MnLCAnTWV5ZXInLCAnQmlzaG9wJywgJ01jQ295JywgJ0hvd2VsbCcsICdBbHZhcmV6JywgJ01vcnJpc29uJywgJ0hhbnNlbicsICdGZXJuYW5kZXonLCAnR2FyemEnLCAnSGFydmV5JywgJ0xpdHRsZScsICdCdXJ0b24nLCAnU3RhbmxleScsICdOZ3V5ZW4nLCAnR2VvcmdlJywgJ0phY29icycsICdSZWlkJywgJ0tpbScsICdGdWxsZXInLCAnTHluY2gnLCAnRGVhbicsICdHaWxiZXJ0JywgJ0dhcnJldHQnLCAnUm9tZXJvJywgJ1dlbGNoJywgJ0xhcnNvbicsICdGcmF6aWVyJywgJ0J1cmtlJywgJ0hhbnNvbicsICdEYXknLCAnTWVuZG96YScsICdNb3Jlbm8nLCAnQm93bWFuJywgJ01lZGluYScsICdGb3dsZXInLCAnQnJld2VyJywgJ0hvZmZtYW4nLCAnQ2FybHNvbicsICdTaWx2YScsICdQZWFyc29uJywgJ0hvbGxhbmQnLCAnRG91Z2xhcycsICdGbGVtaW5nJywgJ0plbnNlbicsICdWYXJnYXMnLCAnQnlyZCcsICdEYXZpZHNvbicsICdIb3BraW5zJywgJ01heScsICdUZXJyeScsICdIZXJyZXJhJywgJ1dhZGUnLCAnU290bycsICdXYWx0ZXJzJywgJ0N1cnRpcycsICdOZWFsJywgJ0NhbGR3ZWxsJywgJ0xvd2UnLCAnSmVubmluZ3MnLCAnQmFybmV0dCcsICdHcmF2ZXMnLCAnSmltZW5leicsICdIb3J0b24nLCAnU2hlbHRvbicsICdCYXJyZXR0JywgJ09icmllbicsICdDYXN0cm8nLCAnU3V0dG9uJywgJ0dyZWdvcnknLCAnTWNLaW5uZXknLCAnTHVjYXMnLCAnTWlsZXMnLCAnQ3JhaWcnLCAnUm9kcmlxdWV6JywgJ0NoYW1iZXJzJywgJ0hvbHQnLCAnTGFtYmVydCcsICdGbGV0Y2hlcicsICdXYXR0cycsICdCYXRlcycsICdIYWxlJywgJ1Job2RlcycsICdQZW5hJywgJ0JlY2snLCAnTmV3bWFuJywgJ0hheW5lcycsICdNY0RhbmllbCcsICdNZW5kZXonLCAnQnVzaCcsICdWYXVnaG4nLCAnUGFya3MnLCAnRGF3c29uJywgJ1NhbnRpYWdvJywgJ05vcnJpcycsICdIYXJkeScsICdMb3ZlJywgJ1N0ZWVsZScsICdDdXJyeScsICdQb3dlcnMnLCAnU2NodWx0eicsICdCYXJrZXInLCAnR3V6bWFuJywgJ1BhZ2UnLCAnTXVub3onLCAnQmFsbCcsICdLZWxsZXInLCAnQ2hhbmRsZXInLCAnV2ViZXInLCAnTGVvbmFyZCcsICdXYWxzaCcsICdMeW9ucycsICdSYW1zZXknLCAnV29sZmUnLCAnU2NobmVpZGVyJywgJ011bGxpbnMnLCAnQmVuc29uJywgJ1NoYXJwJywgJ0Jvd2VuJywgJ0RhbmllbCcsICdCYXJiZXInLCAnQ3VtbWluZ3MnLCAnSGluZXMnLCAnQmFsZHdpbicsICdHcmlmZml0aCcsICdWYWxkZXonLCAnSHViYmFyZCcsICdTYWxhemFyJywgJ1JlZXZlcycsICdXYXJuZXInLCAnU3RldmVuc29uJywgJ0J1cmdlc3MnLCAnU2FudG9zJywgJ1RhdGUnLCAnQ3Jvc3MnLCAnR2FybmVyJywgJ01hbm4nLCAnTWFjaycsICdNb3NzJywgJ1Rob3JudG9uJywgJ0Rlbm5pcycsICdNY0dlZScsICdGYXJtZXInLCAnRGVsZ2FkbycsICdBZ3VpbGFyJywgJ1ZlZ2EnLCAnR2xvdmVyJywgJ01hbm5pbmcnLCAnQ29oZW4nLCAnSGFybW9uJywgJ1JvZGdlcnMnLCAnUm9iYmlucycsICdOZXd0b24nLCAnVG9kZCcsICdCbGFpcicsICdIaWdnaW5zJywgJ0luZ3JhbScsICdSZWVzZScsICdDYW5ub24nLCAnU3RyaWNrbGFuZCcsICdUb3duc2VuZCcsICdQb3R0ZXInLCAnR29vZHdpbicsICdXYWx0b24nLCAnUm93ZScsICdIYW1wdG9uJywgJ09ydGVnYScsICdQYXR0b24nLCAnU3dhbnNvbicsICdKb3NlcGgnLCAnRnJhbmNpcycsICdHb29kbWFuJywgJ01hbGRvbmFkbycsICdZYXRlcycsICdCZWNrZXInLCAnRXJpY2tzb24nLCAnSG9kZ2VzJywgJ1Jpb3MnLCAnQ29ubmVyJywgJ0Fka2lucycsICdXZWJzdGVyJywgJ05vcm1hbicsICdNYWxvbmUnLCAnSGFtbW9uZCcsICdGbG93ZXJzJywgJ0NvYmInLCAnTW9vZHknLCAnUXVpbm4nLCAnQmxha2UnLCAnTWF4d2VsbCcsICdQb3BlJywgJ0Zsb3lkJywgJ09zYm9ybmUnLCAnUGF1bCcsICdNY0NhcnRoeScsICdHdWVycmVybycsICdMaW5kc2V5JywgJ0VzdHJhZGEnLCAnU2FuZG92YWwnLCAnR2liYnMnLCAnVHlsZXInLCAnR3Jvc3MnLCAnRml0emdlcmFsZCcsICdTdG9rZXMnLCAnRG95bGUnLCAnU2hlcm1hbicsICdTYXVuZGVycycsICdXaXNlJywgJ0NvbG9uJywgJ0dpbGwnLCAnQWx2YXJhZG8nLCAnR3JlZXInLCAnUGFkaWxsYScsICdTaW1vbicsICdXYXRlcnMnLCAnTnVuZXonLCAnQmFsbGFyZCcsICdTY2h3YXJ0eicsICdNY0JyaWRlJywgJ0hvdXN0b24nLCAnQ2hyaXN0ZW5zZW4nLCAnS2xlaW4nLCAnUHJhdHQnLCAnQnJpZ2dzJywgJ1BhcnNvbnMnLCAnTWNMYXVnaGxpbicsICdaaW1tZXJtYW4nLCAnRnJlbmNoJywgJ0J1Y2hhbmFuJywgJ01vcmFuJywgJ0NvcGVsYW5kJywgJ1JveScsICdQaXR0bWFuJywgJ0JyYWR5JywgJ01jQ29ybWljaycsICdIb2xsb3dheScsICdCcm9jaycsICdQb29sZScsICdGcmFuaycsICdMb2dhbicsICdPd2VuJywgJ0Jhc3MnLCAnTWFyc2gnLCAnRHJha2UnLCAnV29uZycsICdKZWZmZXJzb24nLCAnUGFyaycsICdNb3J0b24nLCAnQWJib3R0JywgJ1NwYXJrcycsICdQYXRyaWNrJywgJ05vcnRvbicsICdIdWZmJywgJ0NsYXl0b24nLCAnTWFzc2V5JywgJ0xsb3lkJywgJ0ZpZ3Vlcm9hJywgJ0NhcnNvbicsICdCb3dlcnMnLCAnUm9iZXJzb24nLCAnQmFydG9uJywgJ1RyYW4nLCAnTGFtYicsICdIYXJyaW5ndG9uJywgJ0Nhc2V5JywgJ0Jvb25lJywgJ0NvcnRleicsICdDbGFya2UnLCAnTWF0aGlzJywgJ1NpbmdsZXRvbicsICdXaWxraW5zJywgJ0NhaW4nLCAnQnJ5YW4nLCAnVW5kZXJ3b29kJywgJ0hvZ2FuJywgJ01jS2VuemllJywgJ0NvbGxpZXInLCAnTHVuYScsICdQaGVscHMnLCAnTWNHdWlyZScsICdBbGxpc29uJywgJ0JyaWRnZXMnLCAnV2lsa2Vyc29uJywgJ05hc2gnLCAnU3VtbWVycycsICdBdGtpbnMnXSxcblxuICAgICAgICAvLyBEYXRhIHRha2VuIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL3VtcGlyc2t5L2NvdW50cnktbGlzdC9ibG9iL21hc3Rlci9jb3VudHJ5L2NsZHIvZW5fVVMvY291bnRyeS5qc29uXG4gICAgICAgIGNvdW50cmllczogW3tcIm5hbWVcIjpcIkFmZ2hhbmlzdGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFGXCJ9LHtcIm5hbWVcIjpcIkFsYmFuaWFcIixcImFiYnJldmlhdGlvblwiOlwiQUxcIn0se1wibmFtZVwiOlwiQWxnZXJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJEWlwifSx7XCJuYW1lXCI6XCJBbWVyaWNhbiBTYW1vYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBU1wifSx7XCJuYW1lXCI6XCJBbmRvcnJhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFEXCJ9LHtcIm5hbWVcIjpcIkFuZ29sYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBT1wifSx7XCJuYW1lXCI6XCJBbmd1aWxsYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJBSVwifSx7XCJuYW1lXCI6XCJBbnRhcmN0aWNhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFRXCJ9LHtcIm5hbWVcIjpcIkFudGlndWEgYW5kIEJhcmJ1ZGFcIixcImFiYnJldmlhdGlvblwiOlwiQUdcIn0se1wibmFtZVwiOlwiQXJnZW50aW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFSXCJ9LHtcIm5hbWVcIjpcIkFybWVuaWFcIixcImFiYnJldmlhdGlvblwiOlwiQU1cIn0se1wibmFtZVwiOlwiQXJ1YmFcIixcImFiYnJldmlhdGlvblwiOlwiQVdcIn0se1wibmFtZVwiOlwiQXVzdHJhbGlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFVXCJ9LHtcIm5hbWVcIjpcIkF1c3RyaWFcIixcImFiYnJldmlhdGlvblwiOlwiQVRcIn0se1wibmFtZVwiOlwiQXplcmJhaWphblwiLFwiYWJicmV2aWF0aW9uXCI6XCJBWlwifSx7XCJuYW1lXCI6XCJCYWhhbWFzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJTXCJ9LHtcIm5hbWVcIjpcIkJhaHJhaW5cIixcImFiYnJldmlhdGlvblwiOlwiQkhcIn0se1wibmFtZVwiOlwiQmFuZ2xhZGVzaFwiLFwiYWJicmV2aWF0aW9uXCI6XCJCRFwifSx7XCJuYW1lXCI6XCJCYXJiYWRvc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJCQlwifSx7XCJuYW1lXCI6XCJCZWxhcnVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJZXCJ9LHtcIm5hbWVcIjpcIkJlbGdpdW1cIixcImFiYnJldmlhdGlvblwiOlwiQkVcIn0se1wibmFtZVwiOlwiQmVsaXplXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJaXCJ9LHtcIm5hbWVcIjpcIkJlbmluXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJKXCJ9LHtcIm5hbWVcIjpcIkJlcm11ZGFcIixcImFiYnJldmlhdGlvblwiOlwiQk1cIn0se1wibmFtZVwiOlwiQmh1dGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJUXCJ9LHtcIm5hbWVcIjpcIkJvbGl2aWFcIixcImFiYnJldmlhdGlvblwiOlwiQk9cIn0se1wibmFtZVwiOlwiQm9zbmlhIGFuZCBIZXJ6ZWdvdmluYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJCQVwifSx7XCJuYW1lXCI6XCJCb3Rzd2FuYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJCV1wifSx7XCJuYW1lXCI6XCJCb3V2ZXQgSXNsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJWXCJ9LHtcIm5hbWVcIjpcIkJyYXppbFwiLFwiYWJicmV2aWF0aW9uXCI6XCJCUlwifSx7XCJuYW1lXCI6XCJCcml0aXNoIEFudGFyY3RpYyBUZXJyaXRvcnlcIixcImFiYnJldmlhdGlvblwiOlwiQlFcIn0se1wibmFtZVwiOlwiQnJpdGlzaCBJbmRpYW4gT2NlYW4gVGVycml0b3J5XCIsXCJhYmJyZXZpYXRpb25cIjpcIklPXCJ9LHtcIm5hbWVcIjpcIkJyaXRpc2ggVmlyZ2luIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiVkdcIn0se1wibmFtZVwiOlwiQnJ1bmVpXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJOXCJ9LHtcIm5hbWVcIjpcIkJ1bGdhcmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJHXCJ9LHtcIm5hbWVcIjpcIkJ1cmtpbmEgRmFzb1wiLFwiYWJicmV2aWF0aW9uXCI6XCJCRlwifSx7XCJuYW1lXCI6XCJCdXJ1bmRpXCIsXCJhYmJyZXZpYXRpb25cIjpcIkJJXCJ9LHtcIm5hbWVcIjpcIkNhbWJvZGlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIktIXCJ9LHtcIm5hbWVcIjpcIkNhbWVyb29uXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNNXCJ9LHtcIm5hbWVcIjpcIkNhbmFkYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDQVwifSx7XCJuYW1lXCI6XCJDYW50b24gYW5kIEVuZGVyYnVyeSBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNUXCJ9LHtcIm5hbWVcIjpcIkNhcGUgVmVyZGVcIixcImFiYnJldmlhdGlvblwiOlwiQ1ZcIn0se1wibmFtZVwiOlwiQ2F5bWFuIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiS1lcIn0se1wibmFtZVwiOlwiQ2VudHJhbCBBZnJpY2FuIFJlcHVibGljXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNGXCJ9LHtcIm5hbWVcIjpcIkNoYWRcIixcImFiYnJldmlhdGlvblwiOlwiVERcIn0se1wibmFtZVwiOlwiQ2hpbGVcIixcImFiYnJldmlhdGlvblwiOlwiQ0xcIn0se1wibmFtZVwiOlwiQ2hpbmFcIixcImFiYnJldmlhdGlvblwiOlwiQ05cIn0se1wibmFtZVwiOlwiQ2hyaXN0bWFzIElzbGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJDWFwifSx7XCJuYW1lXCI6XCJDb2NvcyBbS2VlbGluZ10gSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJDQ1wifSx7XCJuYW1lXCI6XCJDb2xvbWJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDT1wifSx7XCJuYW1lXCI6XCJDb21vcm9zXCIsXCJhYmJyZXZpYXRpb25cIjpcIktNXCJ9LHtcIm5hbWVcIjpcIkNvbmdvIC0gQnJhenphdmlsbGVcIixcImFiYnJldmlhdGlvblwiOlwiQ0dcIn0se1wibmFtZVwiOlwiQ29uZ28gLSBLaW5zaGFzYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDRFwifSx7XCJuYW1lXCI6XCJDb29rIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiQ0tcIn0se1wibmFtZVwiOlwiQ29zdGEgUmljYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJDUlwifSx7XCJuYW1lXCI6XCJDcm9hdGlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkhSXCJ9LHtcIm5hbWVcIjpcIkN1YmFcIixcImFiYnJldmlhdGlvblwiOlwiQ1VcIn0se1wibmFtZVwiOlwiQ3lwcnVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNZXCJ9LHtcIm5hbWVcIjpcIkN6ZWNoIFJlcHVibGljXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNaXCJ9LHtcIm5hbWVcIjpcIkPDtHRlIGTigJlJdm9pcmVcIixcImFiYnJldmlhdGlvblwiOlwiQ0lcIn0se1wibmFtZVwiOlwiRGVubWFya1wiLFwiYWJicmV2aWF0aW9uXCI6XCJES1wifSx7XCJuYW1lXCI6XCJEamlib3V0aVwiLFwiYWJicmV2aWF0aW9uXCI6XCJESlwifSx7XCJuYW1lXCI6XCJEb21pbmljYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJETVwifSx7XCJuYW1lXCI6XCJEb21pbmljYW4gUmVwdWJsaWNcIixcImFiYnJldmlhdGlvblwiOlwiRE9cIn0se1wibmFtZVwiOlwiRHJvbm5pbmcgTWF1ZCBMYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5RXCJ9LHtcIm5hbWVcIjpcIkVhc3QgR2VybWFueVwiLFwiYWJicmV2aWF0aW9uXCI6XCJERFwifSx7XCJuYW1lXCI6XCJFY3VhZG9yXCIsXCJhYmJyZXZpYXRpb25cIjpcIkVDXCJ9LHtcIm5hbWVcIjpcIkVneXB0XCIsXCJhYmJyZXZpYXRpb25cIjpcIkVHXCJ9LHtcIm5hbWVcIjpcIkVsIFNhbHZhZG9yXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNWXCJ9LHtcIm5hbWVcIjpcIkVxdWF0b3JpYWwgR3VpbmVhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdRXCJ9LHtcIm5hbWVcIjpcIkVyaXRyZWFcIixcImFiYnJldmlhdGlvblwiOlwiRVJcIn0se1wibmFtZVwiOlwiRXN0b25pYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJFRVwifSx7XCJuYW1lXCI6XCJFdGhpb3BpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJFVFwifSx7XCJuYW1lXCI6XCJGYWxrbGFuZCBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkZLXCJ9LHtcIm5hbWVcIjpcIkZhcm9lIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiRk9cIn0se1wibmFtZVwiOlwiRmlqaVwiLFwiYWJicmV2aWF0aW9uXCI6XCJGSlwifSx7XCJuYW1lXCI6XCJGaW5sYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIkZJXCJ9LHtcIm5hbWVcIjpcIkZyYW5jZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJGUlwifSx7XCJuYW1lXCI6XCJGcmVuY2ggR3VpYW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdGXCJ9LHtcIm5hbWVcIjpcIkZyZW5jaCBQb2x5bmVzaWFcIixcImFiYnJldmlhdGlvblwiOlwiUEZcIn0se1wibmFtZVwiOlwiRnJlbmNoIFNvdXRoZXJuIFRlcnJpdG9yaWVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRGXCJ9LHtcIm5hbWVcIjpcIkZyZW5jaCBTb3V0aGVybiBhbmQgQW50YXJjdGljIFRlcnJpdG9yaWVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkZRXCJ9LHtcIm5hbWVcIjpcIkdhYm9uXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdBXCJ9LHtcIm5hbWVcIjpcIkdhbWJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHTVwifSx7XCJuYW1lXCI6XCJHZW9yZ2lhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdFXCJ9LHtcIm5hbWVcIjpcIkdlcm1hbnlcIixcImFiYnJldmlhdGlvblwiOlwiREVcIn0se1wibmFtZVwiOlwiR2hhbmFcIixcImFiYnJldmlhdGlvblwiOlwiR0hcIn0se1wibmFtZVwiOlwiR2licmFsdGFyXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdJXCJ9LHtcIm5hbWVcIjpcIkdyZWVjZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHUlwifSx7XCJuYW1lXCI6XCJHcmVlbmxhbmRcIixcImFiYnJldmlhdGlvblwiOlwiR0xcIn0se1wibmFtZVwiOlwiR3JlbmFkYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHRFwifSx7XCJuYW1lXCI6XCJHdWFkZWxvdXBlXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdQXCJ9LHtcIm5hbWVcIjpcIkd1YW1cIixcImFiYnJldmlhdGlvblwiOlwiR1VcIn0se1wibmFtZVwiOlwiR3VhdGVtYWxhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkdUXCJ9LHtcIm5hbWVcIjpcIkd1ZXJuc2V5XCIsXCJhYmJyZXZpYXRpb25cIjpcIkdHXCJ9LHtcIm5hbWVcIjpcIkd1aW5lYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHTlwifSx7XCJuYW1lXCI6XCJHdWluZWEtQmlzc2F1XCIsXCJhYmJyZXZpYXRpb25cIjpcIkdXXCJ9LHtcIm5hbWVcIjpcIkd1eWFuYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHWVwifSx7XCJuYW1lXCI6XCJIYWl0aVwiLFwiYWJicmV2aWF0aW9uXCI6XCJIVFwifSx7XCJuYW1lXCI6XCJIZWFyZCBJc2xhbmQgYW5kIE1jRG9uYWxkIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiSE1cIn0se1wibmFtZVwiOlwiSG9uZHVyYXNcIixcImFiYnJldmlhdGlvblwiOlwiSE5cIn0se1wibmFtZVwiOlwiSG9uZyBLb25nIFNBUiBDaGluYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJIS1wifSx7XCJuYW1lXCI6XCJIdW5nYXJ5XCIsXCJhYmJyZXZpYXRpb25cIjpcIkhVXCJ9LHtcIm5hbWVcIjpcIkljZWxhbmRcIixcImFiYnJldmlhdGlvblwiOlwiSVNcIn0se1wibmFtZVwiOlwiSW5kaWFcIixcImFiYnJldmlhdGlvblwiOlwiSU5cIn0se1wibmFtZVwiOlwiSW5kb25lc2lhXCIsXCJhYmJyZXZpYXRpb25cIjpcIklEXCJ9LHtcIm5hbWVcIjpcIklyYW5cIixcImFiYnJldmlhdGlvblwiOlwiSVJcIn0se1wibmFtZVwiOlwiSXJhcVwiLFwiYWJicmV2aWF0aW9uXCI6XCJJUVwifSx7XCJuYW1lXCI6XCJJcmVsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIklFXCJ9LHtcIm5hbWVcIjpcIklzbGUgb2YgTWFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIklNXCJ9LHtcIm5hbWVcIjpcIklzcmFlbFwiLFwiYWJicmV2aWF0aW9uXCI6XCJJTFwifSx7XCJuYW1lXCI6XCJJdGFseVwiLFwiYWJicmV2aWF0aW9uXCI6XCJJVFwifSx7XCJuYW1lXCI6XCJKYW1haWNhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkpNXCJ9LHtcIm5hbWVcIjpcIkphcGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIkpQXCJ9LHtcIm5hbWVcIjpcIkplcnNleVwiLFwiYWJicmV2aWF0aW9uXCI6XCJKRVwifSx7XCJuYW1lXCI6XCJKb2huc3RvbiBJc2xhbmRcIixcImFiYnJldmlhdGlvblwiOlwiSlRcIn0se1wibmFtZVwiOlwiSm9yZGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIkpPXCJ9LHtcIm5hbWVcIjpcIkthemFraHN0YW5cIixcImFiYnJldmlhdGlvblwiOlwiS1pcIn0se1wibmFtZVwiOlwiS2VueWFcIixcImFiYnJldmlhdGlvblwiOlwiS0VcIn0se1wibmFtZVwiOlwiS2lyaWJhdGlcIixcImFiYnJldmlhdGlvblwiOlwiS0lcIn0se1wibmFtZVwiOlwiS3V3YWl0XCIsXCJhYmJyZXZpYXRpb25cIjpcIktXXCJ9LHtcIm5hbWVcIjpcIkt5cmd5enN0YW5cIixcImFiYnJldmlhdGlvblwiOlwiS0dcIn0se1wibmFtZVwiOlwiTGFvc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJMQVwifSx7XCJuYW1lXCI6XCJMYXR2aWFcIixcImFiYnJldmlhdGlvblwiOlwiTFZcIn0se1wibmFtZVwiOlwiTGViYW5vblwiLFwiYWJicmV2aWF0aW9uXCI6XCJMQlwifSx7XCJuYW1lXCI6XCJMZXNvdGhvXCIsXCJhYmJyZXZpYXRpb25cIjpcIkxTXCJ9LHtcIm5hbWVcIjpcIkxpYmVyaWFcIixcImFiYnJldmlhdGlvblwiOlwiTFJcIn0se1wibmFtZVwiOlwiTGlieWFcIixcImFiYnJldmlhdGlvblwiOlwiTFlcIn0se1wibmFtZVwiOlwiTGllY2h0ZW5zdGVpblwiLFwiYWJicmV2aWF0aW9uXCI6XCJMSVwifSx7XCJuYW1lXCI6XCJMaXRodWFuaWFcIixcImFiYnJldmlhdGlvblwiOlwiTFRcIn0se1wibmFtZVwiOlwiTHV4ZW1ib3VyZ1wiLFwiYWJicmV2aWF0aW9uXCI6XCJMVVwifSx7XCJuYW1lXCI6XCJNYWNhdSBTQVIgQ2hpbmFcIixcImFiYnJldmlhdGlvblwiOlwiTU9cIn0se1wibmFtZVwiOlwiTWFjZWRvbmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1LXCJ9LHtcIm5hbWVcIjpcIk1hZGFnYXNjYXJcIixcImFiYnJldmlhdGlvblwiOlwiTUdcIn0se1wibmFtZVwiOlwiTWFsYXdpXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1XXCJ9LHtcIm5hbWVcIjpcIk1hbGF5c2lhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1ZXCJ9LHtcIm5hbWVcIjpcIk1hbGRpdmVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1WXCJ9LHtcIm5hbWVcIjpcIk1hbGlcIixcImFiYnJldmlhdGlvblwiOlwiTUxcIn0se1wibmFtZVwiOlwiTWFsdGFcIixcImFiYnJldmlhdGlvblwiOlwiTVRcIn0se1wibmFtZVwiOlwiTWFyc2hhbGwgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJNSFwifSx7XCJuYW1lXCI6XCJNYXJ0aW5pcXVlXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1RXCJ9LHtcIm5hbWVcIjpcIk1hdXJpdGFuaWFcIixcImFiYnJldmlhdGlvblwiOlwiTVJcIn0se1wibmFtZVwiOlwiTWF1cml0aXVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1VXCJ9LHtcIm5hbWVcIjpcIk1heW90dGVcIixcImFiYnJldmlhdGlvblwiOlwiWVRcIn0se1wibmFtZVwiOlwiTWV0cm9wb2xpdGFuIEZyYW5jZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJGWFwifSx7XCJuYW1lXCI6XCJNZXhpY29cIixcImFiYnJldmlhdGlvblwiOlwiTVhcIn0se1wibmFtZVwiOlwiTWljcm9uZXNpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJGTVwifSx7XCJuYW1lXCI6XCJNaWR3YXkgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJNSVwifSx7XCJuYW1lXCI6XCJNb2xkb3ZhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1EXCJ9LHtcIm5hbWVcIjpcIk1vbmFjb1wiLFwiYWJicmV2aWF0aW9uXCI6XCJNQ1wifSx7XCJuYW1lXCI6XCJNb25nb2xpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNTlwifSx7XCJuYW1lXCI6XCJNb250ZW5lZ3JvXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1FXCJ9LHtcIm5hbWVcIjpcIk1vbnRzZXJyYXRcIixcImFiYnJldmlhdGlvblwiOlwiTVNcIn0se1wibmFtZVwiOlwiTW9yb2Njb1wiLFwiYWJicmV2aWF0aW9uXCI6XCJNQVwifSx7XCJuYW1lXCI6XCJNb3phbWJpcXVlXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1aXCJ9LHtcIm5hbWVcIjpcIk15YW5tYXIgW0J1cm1hXVwiLFwiYWJicmV2aWF0aW9uXCI6XCJNTVwifSx7XCJuYW1lXCI6XCJOYW1pYmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5BXCJ9LHtcIm5hbWVcIjpcIk5hdXJ1XCIsXCJhYmJyZXZpYXRpb25cIjpcIk5SXCJ9LHtcIm5hbWVcIjpcIk5lcGFsXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5QXCJ9LHtcIm5hbWVcIjpcIk5ldGhlcmxhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5MXCJ9LHtcIm5hbWVcIjpcIk5ldGhlcmxhbmRzIEFudGlsbGVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIkFOXCJ9LHtcIm5hbWVcIjpcIk5ldXRyYWwgWm9uZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJOVFwifSx7XCJuYW1lXCI6XCJOZXcgQ2FsZWRvbmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5DXCJ9LHtcIm5hbWVcIjpcIk5ldyBaZWFsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5aXCJ9LHtcIm5hbWVcIjpcIk5pY2FyYWd1YVwiLFwiYWJicmV2aWF0aW9uXCI6XCJOSVwifSx7XCJuYW1lXCI6XCJOaWdlclwiLFwiYWJicmV2aWF0aW9uXCI6XCJORVwifSx7XCJuYW1lXCI6XCJOaWdlcmlhXCIsXCJhYmJyZXZpYXRpb25cIjpcIk5HXCJ9LHtcIm5hbWVcIjpcIk5pdWVcIixcImFiYnJldmlhdGlvblwiOlwiTlVcIn0se1wibmFtZVwiOlwiTm9yZm9sayBJc2xhbmRcIixcImFiYnJldmlhdGlvblwiOlwiTkZcIn0se1wibmFtZVwiOlwiTm9ydGggS29yZWFcIixcImFiYnJldmlhdGlvblwiOlwiS1BcIn0se1wibmFtZVwiOlwiTm9ydGggVmlldG5hbVwiLFwiYWJicmV2aWF0aW9uXCI6XCJWRFwifSx7XCJuYW1lXCI6XCJOb3J0aGVybiBNYXJpYW5hIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiTVBcIn0se1wibmFtZVwiOlwiTm9yd2F5XCIsXCJhYmJyZXZpYXRpb25cIjpcIk5PXCJ9LHtcIm5hbWVcIjpcIk9tYW5cIixcImFiYnJldmlhdGlvblwiOlwiT01cIn0se1wibmFtZVwiOlwiUGFjaWZpYyBJc2xhbmRzIFRydXN0IFRlcnJpdG9yeVwiLFwiYWJicmV2aWF0aW9uXCI6XCJQQ1wifSx7XCJuYW1lXCI6XCJQYWtpc3RhblwiLFwiYWJicmV2aWF0aW9uXCI6XCJQS1wifSx7XCJuYW1lXCI6XCJQYWxhdVwiLFwiYWJicmV2aWF0aW9uXCI6XCJQV1wifSx7XCJuYW1lXCI6XCJQYWxlc3RpbmlhbiBUZXJyaXRvcmllc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJQU1wifSx7XCJuYW1lXCI6XCJQYW5hbWFcIixcImFiYnJldmlhdGlvblwiOlwiUEFcIn0se1wibmFtZVwiOlwiUGFuYW1hIENhbmFsIFpvbmVcIixcImFiYnJldmlhdGlvblwiOlwiUFpcIn0se1wibmFtZVwiOlwiUGFwdWEgTmV3IEd1aW5lYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJQR1wifSx7XCJuYW1lXCI6XCJQYXJhZ3VheVwiLFwiYWJicmV2aWF0aW9uXCI6XCJQWVwifSx7XCJuYW1lXCI6XCJQZW9wbGUncyBEZW1vY3JhdGljIFJlcHVibGljIG9mIFllbWVuXCIsXCJhYmJyZXZpYXRpb25cIjpcIllEXCJ9LHtcIm5hbWVcIjpcIlBlcnVcIixcImFiYnJldmlhdGlvblwiOlwiUEVcIn0se1wibmFtZVwiOlwiUGhpbGlwcGluZXNcIixcImFiYnJldmlhdGlvblwiOlwiUEhcIn0se1wibmFtZVwiOlwiUGl0Y2Fpcm4gSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJQTlwifSx7XCJuYW1lXCI6XCJQb2xhbmRcIixcImFiYnJldmlhdGlvblwiOlwiUExcIn0se1wibmFtZVwiOlwiUG9ydHVnYWxcIixcImFiYnJldmlhdGlvblwiOlwiUFRcIn0se1wibmFtZVwiOlwiUHVlcnRvIFJpY29cIixcImFiYnJldmlhdGlvblwiOlwiUFJcIn0se1wibmFtZVwiOlwiUWF0YXJcIixcImFiYnJldmlhdGlvblwiOlwiUUFcIn0se1wibmFtZVwiOlwiUm9tYW5pYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJST1wifSx7XCJuYW1lXCI6XCJSdXNzaWFcIixcImFiYnJldmlhdGlvblwiOlwiUlVcIn0se1wibmFtZVwiOlwiUndhbmRhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlJXXCJ9LHtcIm5hbWVcIjpcIlLDqXVuaW9uXCIsXCJhYmJyZXZpYXRpb25cIjpcIlJFXCJ9LHtcIm5hbWVcIjpcIlNhaW50IEJhcnRow6lsZW15XCIsXCJhYmJyZXZpYXRpb25cIjpcIkJMXCJ9LHtcIm5hbWVcIjpcIlNhaW50IEhlbGVuYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTSFwifSx7XCJuYW1lXCI6XCJTYWludCBLaXR0cyBhbmQgTmV2aXNcIixcImFiYnJldmlhdGlvblwiOlwiS05cIn0se1wibmFtZVwiOlwiU2FpbnQgTHVjaWFcIixcImFiYnJldmlhdGlvblwiOlwiTENcIn0se1wibmFtZVwiOlwiU2FpbnQgTWFydGluXCIsXCJhYmJyZXZpYXRpb25cIjpcIk1GXCJ9LHtcIm5hbWVcIjpcIlNhaW50IFBpZXJyZSBhbmQgTWlxdWVsb25cIixcImFiYnJldmlhdGlvblwiOlwiUE1cIn0se1wibmFtZVwiOlwiU2FpbnQgVmluY2VudCBhbmQgdGhlIEdyZW5hZGluZXNcIixcImFiYnJldmlhdGlvblwiOlwiVkNcIn0se1wibmFtZVwiOlwiU2Ftb2FcIixcImFiYnJldmlhdGlvblwiOlwiV1NcIn0se1wibmFtZVwiOlwiU2FuIE1hcmlub1wiLFwiYWJicmV2aWF0aW9uXCI6XCJTTVwifSx7XCJuYW1lXCI6XCJTYXVkaSBBcmFiaWFcIixcImFiYnJldmlhdGlvblwiOlwiU0FcIn0se1wibmFtZVwiOlwiU2VuZWdhbFwiLFwiYWJicmV2aWF0aW9uXCI6XCJTTlwifSx7XCJuYW1lXCI6XCJTZXJiaWFcIixcImFiYnJldmlhdGlvblwiOlwiUlNcIn0se1wibmFtZVwiOlwiU2VyYmlhIGFuZCBNb250ZW5lZ3JvXCIsXCJhYmJyZXZpYXRpb25cIjpcIkNTXCJ9LHtcIm5hbWVcIjpcIlNleWNoZWxsZXNcIixcImFiYnJldmlhdGlvblwiOlwiU0NcIn0se1wibmFtZVwiOlwiU2llcnJhIExlb25lXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNMXCJ9LHtcIm5hbWVcIjpcIlNpbmdhcG9yZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTR1wifSx7XCJuYW1lXCI6XCJTbG92YWtpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTS1wifSx7XCJuYW1lXCI6XCJTbG92ZW5pYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTSVwifSx7XCJuYW1lXCI6XCJTb2xvbW9uIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiU0JcIn0se1wibmFtZVwiOlwiU29tYWxpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTT1wifSx7XCJuYW1lXCI6XCJTb3V0aCBBZnJpY2FcIixcImFiYnJldmlhdGlvblwiOlwiWkFcIn0se1wibmFtZVwiOlwiU291dGggR2VvcmdpYSBhbmQgdGhlIFNvdXRoIFNhbmR3aWNoIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiR1NcIn0se1wibmFtZVwiOlwiU291dGggS29yZWFcIixcImFiYnJldmlhdGlvblwiOlwiS1JcIn0se1wibmFtZVwiOlwiU3BhaW5cIixcImFiYnJldmlhdGlvblwiOlwiRVNcIn0se1wibmFtZVwiOlwiU3JpIExhbmthXCIsXCJhYmJyZXZpYXRpb25cIjpcIkxLXCJ9LHtcIm5hbWVcIjpcIlN1ZGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNEXCJ9LHtcIm5hbWVcIjpcIlN1cmluYW1lXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNSXCJ9LHtcIm5hbWVcIjpcIlN2YWxiYXJkIGFuZCBKYW4gTWF5ZW5cIixcImFiYnJldmlhdGlvblwiOlwiU0pcIn0se1wibmFtZVwiOlwiU3dhemlsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIlNaXCJ9LHtcIm5hbWVcIjpcIlN3ZWRlblwiLFwiYWJicmV2aWF0aW9uXCI6XCJTRVwifSx7XCJuYW1lXCI6XCJTd2l0emVybGFuZFwiLFwiYWJicmV2aWF0aW9uXCI6XCJDSFwifSx7XCJuYW1lXCI6XCJTeXJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJTWVwifSx7XCJuYW1lXCI6XCJTw6NvIFRvbcOpIGFuZCBQcsOtbmNpcGVcIixcImFiYnJldmlhdGlvblwiOlwiU1RcIn0se1wibmFtZVwiOlwiVGFpd2FuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRXXCJ9LHtcIm5hbWVcIjpcIlRhamlraXN0YW5cIixcImFiYnJldmlhdGlvblwiOlwiVEpcIn0se1wibmFtZVwiOlwiVGFuemFuaWFcIixcImFiYnJldmlhdGlvblwiOlwiVFpcIn0se1wibmFtZVwiOlwiVGhhaWxhbmRcIixcImFiYnJldmlhdGlvblwiOlwiVEhcIn0se1wibmFtZVwiOlwiVGltb3ItTGVzdGVcIixcImFiYnJldmlhdGlvblwiOlwiVExcIn0se1wibmFtZVwiOlwiVG9nb1wiLFwiYWJicmV2aWF0aW9uXCI6XCJUR1wifSx7XCJuYW1lXCI6XCJUb2tlbGF1XCIsXCJhYmJyZXZpYXRpb25cIjpcIlRLXCJ9LHtcIm5hbWVcIjpcIlRvbmdhXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRPXCJ9LHtcIm5hbWVcIjpcIlRyaW5pZGFkIGFuZCBUb2JhZ29cIixcImFiYnJldmlhdGlvblwiOlwiVFRcIn0se1wibmFtZVwiOlwiVHVuaXNpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJUTlwifSx7XCJuYW1lXCI6XCJUdXJrZXlcIixcImFiYnJldmlhdGlvblwiOlwiVFJcIn0se1wibmFtZVwiOlwiVHVya21lbmlzdGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlRNXCJ9LHtcIm5hbWVcIjpcIlR1cmtzIGFuZCBDYWljb3MgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJUQ1wifSx7XCJuYW1lXCI6XCJUdXZhbHVcIixcImFiYnJldmlhdGlvblwiOlwiVFZcIn0se1wibmFtZVwiOlwiVS5TLiBNaW5vciBPdXRseWluZyBJc2xhbmRzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlVNXCJ9LHtcIm5hbWVcIjpcIlUuUy4gTWlzY2VsbGFuZW91cyBQYWNpZmljIElzbGFuZHNcIixcImFiYnJldmlhdGlvblwiOlwiUFVcIn0se1wibmFtZVwiOlwiVS5TLiBWaXJnaW4gSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJWSVwifSx7XCJuYW1lXCI6XCJVZ2FuZGFcIixcImFiYnJldmlhdGlvblwiOlwiVUdcIn0se1wibmFtZVwiOlwiVWtyYWluZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJVQVwifSx7XCJuYW1lXCI6XCJVbmlvbiBvZiBTb3ZpZXQgU29jaWFsaXN0IFJlcHVibGljc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJTVVwifSx7XCJuYW1lXCI6XCJVbml0ZWQgQXJhYiBFbWlyYXRlc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJBRVwifSx7XCJuYW1lXCI6XCJVbml0ZWQgS2luZ2RvbVwiLFwiYWJicmV2aWF0aW9uXCI6XCJHQlwifSx7XCJuYW1lXCI6XCJVbml0ZWQgU3RhdGVzXCIsXCJhYmJyZXZpYXRpb25cIjpcIlVTXCJ9LHtcIm5hbWVcIjpcIlVua25vd24gb3IgSW52YWxpZCBSZWdpb25cIixcImFiYnJldmlhdGlvblwiOlwiWlpcIn0se1wibmFtZVwiOlwiVXJ1Z3VheVwiLFwiYWJicmV2aWF0aW9uXCI6XCJVWVwifSx7XCJuYW1lXCI6XCJVemJla2lzdGFuXCIsXCJhYmJyZXZpYXRpb25cIjpcIlVaXCJ9LHtcIm5hbWVcIjpcIlZhbnVhdHVcIixcImFiYnJldmlhdGlvblwiOlwiVlVcIn0se1wibmFtZVwiOlwiVmF0aWNhbiBDaXR5XCIsXCJhYmJyZXZpYXRpb25cIjpcIlZBXCJ9LHtcIm5hbWVcIjpcIlZlbmV6dWVsYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJWRVwifSx7XCJuYW1lXCI6XCJWaWV0bmFtXCIsXCJhYmJyZXZpYXRpb25cIjpcIlZOXCJ9LHtcIm5hbWVcIjpcIldha2UgSXNsYW5kXCIsXCJhYmJyZXZpYXRpb25cIjpcIldLXCJ9LHtcIm5hbWVcIjpcIldhbGxpcyBhbmQgRnV0dW5hXCIsXCJhYmJyZXZpYXRpb25cIjpcIldGXCJ9LHtcIm5hbWVcIjpcIldlc3Rlcm4gU2FoYXJhXCIsXCJhYmJyZXZpYXRpb25cIjpcIkVIXCJ9LHtcIm5hbWVcIjpcIlllbWVuXCIsXCJhYmJyZXZpYXRpb25cIjpcIllFXCJ9LHtcIm5hbWVcIjpcIlphbWJpYVwiLFwiYWJicmV2aWF0aW9uXCI6XCJaTVwifSx7XCJuYW1lXCI6XCJaaW1iYWJ3ZVwiLFwiYWJicmV2aWF0aW9uXCI6XCJaV1wifSx7XCJuYW1lXCI6XCLDhWxhbmQgSXNsYW5kc1wiLFwiYWJicmV2aWF0aW9uXCI6XCJBWFwifV0sXG5cbiAgICAgICAgcHJvdmluY2VzOiBbXG4gICAgICAgICAgICB7bmFtZTogJ0FsYmVydGEnLCBhYmJyZXZpYXRpb246ICdBQid9LFxuICAgICAgICAgICAge25hbWU6ICdCcml0aXNoIENvbHVtYmlhJywgYWJicmV2aWF0aW9uOiAnQkMnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWFuaXRvYmEnLCBhYmJyZXZpYXRpb246ICdNQid9LFxuICAgICAgICAgICAge25hbWU6ICdOZXcgQnJ1bnN3aWNrJywgYWJicmV2aWF0aW9uOiAnTkInfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTmV3Zm91bmRsYW5kIGFuZCBMYWJyYWRvcicsIGFiYnJldmlhdGlvbjogJ05MJ30sXG4gICAgICAgICAgICB7bmFtZTogJ05vdmEgU2NvdGlhJywgYWJicmV2aWF0aW9uOiAnTlMnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnT250YXJpbycsIGFiYnJldmlhdGlvbjogJ09OJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1ByaW5jZSBFZHdhcmQgSXNsYW5kJywgYWJicmV2aWF0aW9uOiAnUEUnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnUXVlYmVjJywgYWJicmV2aWF0aW9uOiAnUUMnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnU2Fza2F0Y2hld2FuJywgYWJicmV2aWF0aW9uOiAnU0snfSxcblxuICAgICAgICAgICAgLy8gVGhlIGNhc2UgY291bGQgYmUgbWFkZSB0aGF0IHRoZSBmb2xsb3dpbmcgYXJlIG5vdCBhY3R1YWxseSBwcm92aW5jZXNcbiAgICAgICAgICAgIC8vIHNpbmNlIHRoZXkgYXJlIHRlY2huaWNhbGx5IGNvbnNpZGVyZWQgXCJ0ZXJyaXRvcmllc1wiIGhvd2V2ZXIgdGhleSBhbGxcbiAgICAgICAgICAgIC8vIGxvb2sgdGhlIHNhbWUgb24gYW4gZW52ZWxvcGUhXG4gICAgICAgICAgICB7bmFtZTogJ05vcnRod2VzdCBUZXJyaXRvcmllcycsIGFiYnJldmlhdGlvbjogJ05UJ30sXG4gICAgICAgICAgICB7bmFtZTogJ051bmF2dXQnLCBhYmJyZXZpYXRpb246ICdOVSd9LFxuICAgICAgICAgICAge25hbWU6ICdZdWtvbicsIGFiYnJldmlhdGlvbjogJ1lUJ31cbiAgICAgICAgXSxcblxuICAgICAgICB1c19zdGF0ZXNfYW5kX2RjOiBbXG4gICAgICAgICAgICB7bmFtZTogJ0FsYWJhbWEnLCBhYmJyZXZpYXRpb246ICdBTCd9LFxuICAgICAgICAgICAge25hbWU6ICdBbGFza2EnLCBhYmJyZXZpYXRpb246ICdBSyd9LFxuICAgICAgICAgICAge25hbWU6ICdBcml6b25hJywgYWJicmV2aWF0aW9uOiAnQVonfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQXJrYW5zYXMnLCBhYmJyZXZpYXRpb246ICdBUid9LFxuICAgICAgICAgICAge25hbWU6ICdDYWxpZm9ybmlhJywgYWJicmV2aWF0aW9uOiAnQ0EnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQ29sb3JhZG8nLCBhYmJyZXZpYXRpb246ICdDTyd9LFxuICAgICAgICAgICAge25hbWU6ICdDb25uZWN0aWN1dCcsIGFiYnJldmlhdGlvbjogJ0NUJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0RlbGF3YXJlJywgYWJicmV2aWF0aW9uOiAnREUnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnRGlzdHJpY3Qgb2YgQ29sdW1iaWEnLCBhYmJyZXZpYXRpb246ICdEQyd9LFxuICAgICAgICAgICAge25hbWU6ICdGbG9yaWRhJywgYWJicmV2aWF0aW9uOiAnRkwnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnR2VvcmdpYScsIGFiYnJldmlhdGlvbjogJ0dBJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0hhd2FpaScsIGFiYnJldmlhdGlvbjogJ0hJJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0lkYWhvJywgYWJicmV2aWF0aW9uOiAnSUQnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnSWxsaW5vaXMnLCBhYmJyZXZpYXRpb246ICdJTCd9LFxuICAgICAgICAgICAge25hbWU6ICdJbmRpYW5hJywgYWJicmV2aWF0aW9uOiAnSU4nfSxcbiAgICAgICAgICAgIHtuYW1lOiAnSW93YScsIGFiYnJldmlhdGlvbjogJ0lBJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0thbnNhcycsIGFiYnJldmlhdGlvbjogJ0tTJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0tlbnR1Y2t5JywgYWJicmV2aWF0aW9uOiAnS1knfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTG91aXNpYW5hJywgYWJicmV2aWF0aW9uOiAnTEEnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWFpbmUnLCBhYmJyZXZpYXRpb246ICdNRSd9LFxuICAgICAgICAgICAge25hbWU6ICdNYXJ5bGFuZCcsIGFiYnJldmlhdGlvbjogJ01EJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01hc3NhY2h1c2V0dHMnLCBhYmJyZXZpYXRpb246ICdNQSd9LFxuICAgICAgICAgICAge25hbWU6ICdNaWNoaWdhbicsIGFiYnJldmlhdGlvbjogJ01JJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01pbm5lc290YScsIGFiYnJldmlhdGlvbjogJ01OJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01pc3Npc3NpcHBpJywgYWJicmV2aWF0aW9uOiAnTVMnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWlzc291cmknLCBhYmJyZXZpYXRpb246ICdNTyd9LFxuICAgICAgICAgICAge25hbWU6ICdNb250YW5hJywgYWJicmV2aWF0aW9uOiAnTVQnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTmVicmFza2EnLCBhYmJyZXZpYXRpb246ICdORSd9LFxuICAgICAgICAgICAge25hbWU6ICdOZXZhZGEnLCBhYmJyZXZpYXRpb246ICdOVid9LFxuICAgICAgICAgICAge25hbWU6ICdOZXcgSGFtcHNoaXJlJywgYWJicmV2aWF0aW9uOiAnTkgnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTmV3IEplcnNleScsIGFiYnJldmlhdGlvbjogJ05KJ30sXG4gICAgICAgICAgICB7bmFtZTogJ05ldyBNZXhpY28nLCBhYmJyZXZpYXRpb246ICdOTSd9LFxuICAgICAgICAgICAge25hbWU6ICdOZXcgWW9yaycsIGFiYnJldmlhdGlvbjogJ05ZJ30sXG4gICAgICAgICAgICB7bmFtZTogJ05vcnRoIENhcm9saW5hJywgYWJicmV2aWF0aW9uOiAnTkMnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTm9ydGggRGFrb3RhJywgYWJicmV2aWF0aW9uOiAnTkQnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnT2hpbycsIGFiYnJldmlhdGlvbjogJ09IJ30sXG4gICAgICAgICAgICB7bmFtZTogJ09rbGFob21hJywgYWJicmV2aWF0aW9uOiAnT0snfSxcbiAgICAgICAgICAgIHtuYW1lOiAnT3JlZ29uJywgYWJicmV2aWF0aW9uOiAnT1InfSxcbiAgICAgICAgICAgIHtuYW1lOiAnUGVubnN5bHZhbmlhJywgYWJicmV2aWF0aW9uOiAnUEEnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnUmhvZGUgSXNsYW5kJywgYWJicmV2aWF0aW9uOiAnUkknfSxcbiAgICAgICAgICAgIHtuYW1lOiAnU291dGggQ2Fyb2xpbmEnLCBhYmJyZXZpYXRpb246ICdTQyd9LFxuICAgICAgICAgICAge25hbWU6ICdTb3V0aCBEYWtvdGEnLCBhYmJyZXZpYXRpb246ICdTRCd9LFxuICAgICAgICAgICAge25hbWU6ICdUZW5uZXNzZWUnLCBhYmJyZXZpYXRpb246ICdUTid9LFxuICAgICAgICAgICAge25hbWU6ICdUZXhhcycsIGFiYnJldmlhdGlvbjogJ1RYJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1V0YWgnLCBhYmJyZXZpYXRpb246ICdVVCd9LFxuICAgICAgICAgICAge25hbWU6ICdWZXJtb250JywgYWJicmV2aWF0aW9uOiAnVlQnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnVmlyZ2luaWEnLCBhYmJyZXZpYXRpb246ICdWQSd9LFxuICAgICAgICAgICAge25hbWU6ICdXYXNoaW5ndG9uJywgYWJicmV2aWF0aW9uOiAnV0EnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnV2VzdCBWaXJnaW5pYScsIGFiYnJldmlhdGlvbjogJ1dWJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1dpc2NvbnNpbicsIGFiYnJldmlhdGlvbjogJ1dJJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1d5b21pbmcnLCBhYmJyZXZpYXRpb246ICdXWSd9XG4gICAgICAgIF0sXG5cbiAgICAgICAgdGVycml0b3JpZXM6IFtcbiAgICAgICAgICAgIHtuYW1lOiAnQW1lcmljYW4gU2Ftb2EnLCBhYmJyZXZpYXRpb246ICdBUyd9LFxuICAgICAgICAgICAge25hbWU6ICdGZWRlcmF0ZWQgU3RhdGVzIG9mIE1pY3JvbmVzaWEnLCBhYmJyZXZpYXRpb246ICdGTSd9LFxuICAgICAgICAgICAge25hbWU6ICdHdWFtJywgYWJicmV2aWF0aW9uOiAnR1UnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWFyc2hhbGwgSXNsYW5kcycsIGFiYnJldmlhdGlvbjogJ01IJ30sXG4gICAgICAgICAgICB7bmFtZTogJ05vcnRoZXJuIE1hcmlhbmEgSXNsYW5kcycsIGFiYnJldmlhdGlvbjogJ01QJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1B1ZXJ0byBSaWNvJywgYWJicmV2aWF0aW9uOiAnUFInfSxcbiAgICAgICAgICAgIHtuYW1lOiAnVmlyZ2luIElzbGFuZHMsIFUuUy4nLCBhYmJyZXZpYXRpb246ICdWSSd9XG4gICAgICAgIF0sXG5cbiAgICAgICAgYXJtZWRfZm9yY2VzOiBbXG4gICAgICAgICAgICB7bmFtZTogJ0FybWVkIEZvcmNlcyBFdXJvcGUnLCBhYmJyZXZpYXRpb246ICdBRSd9LFxuICAgICAgICAgICAge25hbWU6ICdBcm1lZCBGb3JjZXMgUGFjaWZpYycsIGFiYnJldmlhdGlvbjogJ0FQJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0FybWVkIEZvcmNlcyB0aGUgQW1lcmljYXMnLCBhYmJyZXZpYXRpb246ICdBQSd9XG4gICAgICAgIF0sXG5cbiAgICAgICAgc3RyZWV0X3N1ZmZpeGVzOiBbXG4gICAgICAgICAgICB7bmFtZTogJ0F2ZW51ZScsIGFiYnJldmlhdGlvbjogJ0F2ZSd9LFxuICAgICAgICAgICAge25hbWU6ICdCb3VsZXZhcmQnLCBhYmJyZXZpYXRpb246ICdCbHZkJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0NlbnRlcicsIGFiYnJldmlhdGlvbjogJ0N0cid9LFxuICAgICAgICAgICAge25hbWU6ICdDaXJjbGUnLCBhYmJyZXZpYXRpb246ICdDaXInfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQ291cnQnLCBhYmJyZXZpYXRpb246ICdDdCd9LFxuICAgICAgICAgICAge25hbWU6ICdEcml2ZScsIGFiYnJldmlhdGlvbjogJ0RyJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0V4dGVuc2lvbicsIGFiYnJldmlhdGlvbjogJ0V4dCd9LFxuICAgICAgICAgICAge25hbWU6ICdHbGVuJywgYWJicmV2aWF0aW9uOiAnR2xuJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0dyb3ZlJywgYWJicmV2aWF0aW9uOiAnR3J2J30sXG4gICAgICAgICAgICB7bmFtZTogJ0hlaWdodHMnLCBhYmJyZXZpYXRpb246ICdIdHMnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnSGlnaHdheScsIGFiYnJldmlhdGlvbjogJ0h3eSd9LFxuICAgICAgICAgICAge25hbWU6ICdKdW5jdGlvbicsIGFiYnJldmlhdGlvbjogJ0pjdCd9LFxuICAgICAgICAgICAge25hbWU6ICdLZXknLCBhYmJyZXZpYXRpb246ICdLZXknfSxcbiAgICAgICAgICAgIHtuYW1lOiAnTGFuZScsIGFiYnJldmlhdGlvbjogJ0xuJ30sXG4gICAgICAgICAgICB7bmFtZTogJ0xvb3AnLCBhYmJyZXZpYXRpb246ICdMb29wJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01hbm9yJywgYWJicmV2aWF0aW9uOiAnTW5yJ30sXG4gICAgICAgICAgICB7bmFtZTogJ01pbGwnLCBhYmJyZXZpYXRpb246ICdNaWxsJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1BhcmsnLCBhYmJyZXZpYXRpb246ICdQYXJrJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1Bhcmt3YXknLCBhYmJyZXZpYXRpb246ICdQa3d5J30sXG4gICAgICAgICAgICB7bmFtZTogJ1Bhc3MnLCBhYmJyZXZpYXRpb246ICdQYXNzJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1BhdGgnLCBhYmJyZXZpYXRpb246ICdQYXRoJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1Bpa2UnLCBhYmJyZXZpYXRpb246ICdQaWtlJ30sXG4gICAgICAgICAgICB7bmFtZTogJ1BsYWNlJywgYWJicmV2aWF0aW9uOiAnUGwnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnUGxhemEnLCBhYmJyZXZpYXRpb246ICdQbHonfSxcbiAgICAgICAgICAgIHtuYW1lOiAnUG9pbnQnLCBhYmJyZXZpYXRpb246ICdQdCd9LFxuICAgICAgICAgICAge25hbWU6ICdSaWRnZScsIGFiYnJldmlhdGlvbjogJ1JkZyd9LFxuICAgICAgICAgICAge25hbWU6ICdSaXZlcicsIGFiYnJldmlhdGlvbjogJ1Jpdid9LFxuICAgICAgICAgICAge25hbWU6ICdSb2FkJywgYWJicmV2aWF0aW9uOiAnUmQnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnU3F1YXJlJywgYWJicmV2aWF0aW9uOiAnU3EnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnU3RyZWV0JywgYWJicmV2aWF0aW9uOiAnU3QnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnVGVycmFjZScsIGFiYnJldmlhdGlvbjogJ1Rlcid9LFxuICAgICAgICAgICAge25hbWU6ICdUcmFpbCcsIGFiYnJldmlhdGlvbjogJ1RybCd9LFxuICAgICAgICAgICAge25hbWU6ICdUdXJucGlrZScsIGFiYnJldmlhdGlvbjogJ1Rwa2UnfSxcbiAgICAgICAgICAgIHtuYW1lOiAnVmlldycsIGFiYnJldmlhdGlvbjogJ1Z3J30sXG4gICAgICAgICAgICB7bmFtZTogJ1dheScsIGFiYnJldmlhdGlvbjogJ1dheSd9XG4gICAgICAgIF0sXG5cbiAgICAgICAgbW9udGhzOiBbXG4gICAgICAgICAgICB7bmFtZTogJ0phbnVhcnknLCBzaG9ydF9uYW1lOiAnSmFuJywgbnVtZXJpYzogJzAxJywgZGF5czogMzF9LFxuICAgICAgICAgICAgLy8gTm90IG1lc3Npbmcgd2l0aCBsZWFwIHllYXJzLi4uXG4gICAgICAgICAgICB7bmFtZTogJ0ZlYnJ1YXJ5Jywgc2hvcnRfbmFtZTogJ0ZlYicsIG51bWVyaWM6ICcwMicsIGRheXM6IDI4fSxcbiAgICAgICAgICAgIHtuYW1lOiAnTWFyY2gnLCBzaG9ydF9uYW1lOiAnTWFyJywgbnVtZXJpYzogJzAzJywgZGF5czogMzF9LFxuICAgICAgICAgICAge25hbWU6ICdBcHJpbCcsIHNob3J0X25hbWU6ICdBcHInLCBudW1lcmljOiAnMDQnLCBkYXlzOiAzMH0sXG4gICAgICAgICAgICB7bmFtZTogJ01heScsIHNob3J0X25hbWU6ICdNYXknLCBudW1lcmljOiAnMDUnLCBkYXlzOiAzMX0sXG4gICAgICAgICAgICB7bmFtZTogJ0p1bmUnLCBzaG9ydF9uYW1lOiAnSnVuJywgbnVtZXJpYzogJzA2JywgZGF5czogMzB9LFxuICAgICAgICAgICAge25hbWU6ICdKdWx5Jywgc2hvcnRfbmFtZTogJ0p1bCcsIG51bWVyaWM6ICcwNycsIGRheXM6IDMxfSxcbiAgICAgICAgICAgIHtuYW1lOiAnQXVndXN0Jywgc2hvcnRfbmFtZTogJ0F1ZycsIG51bWVyaWM6ICcwOCcsIGRheXM6IDMxfSxcbiAgICAgICAgICAgIHtuYW1lOiAnU2VwdGVtYmVyJywgc2hvcnRfbmFtZTogJ1NlcCcsIG51bWVyaWM6ICcwOScsIGRheXM6IDMwfSxcbiAgICAgICAgICAgIHtuYW1lOiAnT2N0b2JlcicsIHNob3J0X25hbWU6ICdPY3QnLCBudW1lcmljOiAnMTAnLCBkYXlzOiAzMX0sXG4gICAgICAgICAgICB7bmFtZTogJ05vdmVtYmVyJywgc2hvcnRfbmFtZTogJ05vdicsIG51bWVyaWM6ICcxMScsIGRheXM6IDMwfSxcbiAgICAgICAgICAgIHtuYW1lOiAnRGVjZW1iZXInLCBzaG9ydF9uYW1lOiAnRGVjJywgbnVtZXJpYzogJzEyJywgZGF5czogMzF9XG4gICAgICAgIF0sXG5cbiAgICAgICAgLy8gaHR0cDovL2VuLndpa2lwZWRpYS5vcmcvd2lraS9CYW5rX2NhcmRfbnVtYmVyI0lzc3Vlcl9pZGVudGlmaWNhdGlvbl9udW1iZXJfLjI4SUlOLjI5XG4gICAgICAgIGNjX3R5cGVzOiBbXG4gICAgICAgICAgICB7bmFtZTogXCJBbWVyaWNhbiBFeHByZXNzXCIsIHNob3J0X25hbWU6ICdhbWV4JywgcHJlZml4OiAnMzQnLCBsZW5ndGg6IDE1fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkJhbmtjYXJkXCIsIHNob3J0X25hbWU6ICdiYW5rY2FyZCcsIHByZWZpeDogJzU2MTAnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkNoaW5hIFVuaW9uUGF5XCIsIHNob3J0X25hbWU6ICdjaGluYXVuaW9uJywgcHJlZml4OiAnNjInLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkRpbmVycyBDbHViIENhcnRlIEJsYW5jaGVcIiwgc2hvcnRfbmFtZTogJ2RjY2FydGUnLCBwcmVmaXg6ICczMDAnLCBsZW5ndGg6IDE0fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkRpbmVycyBDbHViIGVuUm91dGVcIiwgc2hvcnRfbmFtZTogJ2RjZW5yb3V0ZScsIHByZWZpeDogJzIwMTQnLCBsZW5ndGg6IDE1fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkRpbmVycyBDbHViIEludGVybmF0aW9uYWxcIiwgc2hvcnRfbmFtZTogJ2RjaW50bCcsIHByZWZpeDogJzM2JywgbGVuZ3RoOiAxNH0sXG4gICAgICAgICAgICB7bmFtZTogXCJEaW5lcnMgQ2x1YiBVbml0ZWQgU3RhdGVzICYgQ2FuYWRhXCIsIHNob3J0X25hbWU6ICdkY3VzYycsIHByZWZpeDogJzU0JywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJEaXNjb3ZlciBDYXJkXCIsIHNob3J0X25hbWU6ICdkaXNjb3ZlcicsIHByZWZpeDogJzYwMTEnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkluc3RhUGF5bWVudFwiLCBzaG9ydF9uYW1lOiAnaW5zdGFwYXknLCBwcmVmaXg6ICc2MzcnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIkpDQlwiLCBzaG9ydF9uYW1lOiAnamNiJywgcHJlZml4OiAnMzUyOCcsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiTGFzZXJcIiwgc2hvcnRfbmFtZTogJ2xhc2VyJywgcHJlZml4OiAnNjMwNCcsIGxlbmd0aDogMTZ9LFxuICAgICAgICAgICAge25hbWU6IFwiTWFlc3Ryb1wiLCBzaG9ydF9uYW1lOiAnbWFlc3RybycsIHByZWZpeDogJzUwMTgnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIk1hc3RlcmNhcmRcIiwgc2hvcnRfbmFtZTogJ21jJywgcHJlZml4OiAnNTEnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIlNvbG9cIiwgc2hvcnRfbmFtZTogJ3NvbG8nLCBwcmVmaXg6ICc2MzM0JywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJTd2l0Y2hcIiwgc2hvcnRfbmFtZTogJ3N3aXRjaCcsIHByZWZpeDogJzQ5MDMnLCBsZW5ndGg6IDE2fSxcbiAgICAgICAgICAgIHtuYW1lOiBcIlZpc2FcIiwgc2hvcnRfbmFtZTogJ3Zpc2EnLCBwcmVmaXg6ICc0JywgbGVuZ3RoOiAxNn0sXG4gICAgICAgICAgICB7bmFtZTogXCJWaXNhIEVsZWN0cm9uXCIsIHNob3J0X25hbWU6ICdlbGVjdHJvbicsIHByZWZpeDogJzQwMjYnLCBsZW5ndGg6IDE2fVxuICAgICAgICBdLFxuXG4gICAgICAgIC8vcmV0dXJuIGFsbCB3b3JsZCBjdXJyZW5jeSBieSBJU08gNDIxN1xuICAgICAgICBjdXJyZW5jeV90eXBlczogW1xuICAgICAgICAgICAgeydjb2RlJyA6ICdBRUQnLCAnbmFtZScgOiAnVW5pdGVkIEFyYWIgRW1pcmF0ZXMgRGlyaGFtJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FGTicsICduYW1lJyA6ICdBZmdoYW5pc3RhbiBBZmdoYW5pJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FMTCcsICduYW1lJyA6ICdBbGJhbmlhIExlayd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdBTUQnLCAnbmFtZScgOiAnQXJtZW5pYSBEcmFtJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FORycsICduYW1lJyA6ICdOZXRoZXJsYW5kcyBBbnRpbGxlcyBHdWlsZGVyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FPQScsICduYW1lJyA6ICdBbmdvbGEgS3dhbnphJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0FSUycsICduYW1lJyA6ICdBcmdlbnRpbmEgUGVzbyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdBVUQnLCAnbmFtZScgOiAnQXVzdHJhbGlhIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdBV0cnLCAnbmFtZScgOiAnQXJ1YmEgR3VpbGRlcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdBWk4nLCAnbmFtZScgOiAnQXplcmJhaWphbiBOZXcgTWFuYXQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQkFNJywgJ25hbWUnIDogJ0Jvc25pYSBhbmQgSGVyemVnb3ZpbmEgQ29udmVydGlibGUgTWFya2EnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQkJEJywgJ25hbWUnIDogJ0JhcmJhZG9zIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCRFQnLCAnbmFtZScgOiAnQmFuZ2xhZGVzaCBUYWthJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JHTicsICduYW1lJyA6ICdCdWxnYXJpYSBMZXYnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQkhEJywgJ25hbWUnIDogJ0JhaHJhaW4gRGluYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQklGJywgJ25hbWUnIDogJ0J1cnVuZGkgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQk1EJywgJ25hbWUnIDogJ0Jlcm11ZGEgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JORCcsICduYW1lJyA6ICdCcnVuZWkgRGFydXNzYWxhbSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQk9CJywgJ25hbWUnIDogJ0JvbGl2aWEgQm9saXZpYW5vJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0JSTCcsICduYW1lJyA6ICdCcmF6aWwgUmVhbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCU0QnLCAnbmFtZScgOiAnQmFoYW1hcyBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQlROJywgJ25hbWUnIDogJ0JodXRhbiBOZ3VsdHJ1bSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCV1AnLCAnbmFtZScgOiAnQm90c3dhbmEgUHVsYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCWVInLCAnbmFtZScgOiAnQmVsYXJ1cyBSdWJsZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdCWkQnLCAnbmFtZScgOiAnQmVsaXplIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDQUQnLCAnbmFtZScgOiAnQ2FuYWRhIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDREYnLCAnbmFtZScgOiAnQ29uZ28vS2luc2hhc2EgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ0hGJywgJ25hbWUnIDogJ1N3aXR6ZXJsYW5kIEZyYW5jJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NMUCcsICduYW1lJyA6ICdDaGlsZSBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NOWScsICduYW1lJyA6ICdDaGluYSBZdWFuIFJlbm1pbmJpJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NPUCcsICduYW1lJyA6ICdDb2xvbWJpYSBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NSQycsICduYW1lJyA6ICdDb3N0YSBSaWNhIENvbG9uJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0NVQycsICduYW1lJyA6ICdDdWJhIENvbnZlcnRpYmxlIFBlc28nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ1VQJywgJ25hbWUnIDogJ0N1YmEgUGVzbyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdDVkUnLCAnbmFtZScgOiAnQ2FwZSBWZXJkZSBFc2N1ZG8nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnQ1pLJywgJ25hbWUnIDogJ0N6ZWNoIFJlcHVibGljIEtvcnVuYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdESkYnLCAnbmFtZScgOiAnRGppYm91dGkgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnREtLJywgJ25hbWUnIDogJ0Rlbm1hcmsgS3JvbmUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnRE9QJywgJ25hbWUnIDogJ0RvbWluaWNhbiBSZXB1YmxpYyBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0RaRCcsICduYW1lJyA6ICdBbGdlcmlhIERpbmFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0VHUCcsICduYW1lJyA6ICdFZ3lwdCBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdFUk4nLCAnbmFtZScgOiAnRXJpdHJlYSBOYWtmYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdFVEInLCAnbmFtZScgOiAnRXRoaW9waWEgQmlycid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdFVVInLCAnbmFtZScgOiAnRXVybyBNZW1iZXIgQ291bnRyaWVzJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0ZKRCcsICduYW1lJyA6ICdGaWppIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdGS1AnLCAnbmFtZScgOiAnRmFsa2xhbmQgSXNsYW5kcyAoTWFsdmluYXMpIFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dCUCcsICduYW1lJyA6ICdVbml0ZWQgS2luZ2RvbSBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdHRUwnLCAnbmFtZScgOiAnR2VvcmdpYSBMYXJpJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dHUCcsICduYW1lJyA6ICdHdWVybnNleSBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdHSFMnLCAnbmFtZScgOiAnR2hhbmEgQ2VkaSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdHSVAnLCAnbmFtZScgOiAnR2licmFsdGFyIFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dNRCcsICduYW1lJyA6ICdHYW1iaWEgRGFsYXNpJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dORicsICduYW1lJyA6ICdHdWluZWEgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnR1RRJywgJ25hbWUnIDogJ0d1YXRlbWFsYSBRdWV0emFsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0dZRCcsICduYW1lJyA6ICdHdXlhbmEgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0hLRCcsICduYW1lJyA6ICdIb25nIEtvbmcgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0hOTCcsICduYW1lJyA6ICdIb25kdXJhcyBMZW1waXJhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0hSSycsICduYW1lJyA6ICdDcm9hdGlhIEt1bmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSFRHJywgJ25hbWUnIDogJ0hhaXRpIEdvdXJkZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdIVUYnLCAnbmFtZScgOiAnSHVuZ2FyeSBGb3JpbnQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSURSJywgJ25hbWUnIDogJ0luZG9uZXNpYSBSdXBpYWgnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSUxTJywgJ25hbWUnIDogJ0lzcmFlbCBTaGVrZWwnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSU1QJywgJ25hbWUnIDogJ0lzbGUgb2YgTWFuIFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0lOUicsICduYW1lJyA6ICdJbmRpYSBSdXBlZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdJUUQnLCAnbmFtZScgOiAnSXJhcSBEaW5hcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdJUlInLCAnbmFtZScgOiAnSXJhbiBSaWFsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0lTSycsICduYW1lJyA6ICdJY2VsYW5kIEtyb25hJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0pFUCcsICduYW1lJyA6ICdKZXJzZXkgUG91bmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSk1EJywgJ25hbWUnIDogJ0phbWFpY2EgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0pPRCcsICduYW1lJyA6ICdKb3JkYW4gRGluYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnSlBZJywgJ25hbWUnIDogJ0phcGFuIFllbid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdLRVMnLCAnbmFtZScgOiAnS2VueWEgU2hpbGxpbmcnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnS0dTJywgJ25hbWUnIDogJ0t5cmd5enN0YW4gU29tJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0tIUicsICduYW1lJyA6ICdDYW1ib2RpYSBSaWVsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0tNRicsICduYW1lJyA6ICdDb21vcm9zIEZyYW5jJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0tQVycsICduYW1lJyA6ICdLb3JlYSAoTm9ydGgpIFdvbid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdLUlcnLCAnbmFtZScgOiAnS29yZWEgKFNvdXRoKSBXb24nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnS1dEJywgJ25hbWUnIDogJ0t1d2FpdCBEaW5hcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdLWUQnLCAnbmFtZScgOiAnQ2F5bWFuIElzbGFuZHMgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0taVCcsICduYW1lJyA6ICdLYXpha2hzdGFuIFRlbmdlJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0xBSycsICduYW1lJyA6ICdMYW9zIEtpcCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdMQlAnLCAnbmFtZScgOiAnTGViYW5vbiBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdMS1InLCAnbmFtZScgOiAnU3JpIExhbmthIFJ1cGVlJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0xSRCcsICduYW1lJyA6ICdMaWJlcmlhIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdMU0wnLCAnbmFtZScgOiAnTGVzb3RobyBMb3RpJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ0xUTCcsICduYW1lJyA6ICdMaXRodWFuaWEgTGl0YXMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTFlEJywgJ25hbWUnIDogJ0xpYnlhIERpbmFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01BRCcsICduYW1lJyA6ICdNb3JvY2NvIERpcmhhbSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNREwnLCAnbmFtZScgOiAnTW9sZG92YSBMZXUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTUdBJywgJ25hbWUnIDogJ01hZGFnYXNjYXIgQXJpYXJ5J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01LRCcsICduYW1lJyA6ICdNYWNlZG9uaWEgRGVuYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTU1LJywgJ25hbWUnIDogJ015YW5tYXIgKEJ1cm1hKSBLeWF0J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01OVCcsICduYW1lJyA6ICdNb25nb2xpYSBUdWdocmlrJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01PUCcsICduYW1lJyA6ICdNYWNhdSBQYXRhY2EnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTVJPJywgJ25hbWUnIDogJ01hdXJpdGFuaWEgT3VndWl5YSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNVVInLCAnbmFtZScgOiAnTWF1cml0aXVzIFJ1cGVlJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01WUicsICduYW1lJyA6ICdNYWxkaXZlcyAoTWFsZGl2ZSBJc2xhbmRzKSBSdWZpeWFhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01XSycsICduYW1lJyA6ICdNYWxhd2kgS3dhY2hhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ01YTicsICduYW1lJyA6ICdNZXhpY28gUGVzbyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNWVInLCAnbmFtZScgOiAnTWFsYXlzaWEgUmluZ2dpdCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdNWk4nLCAnbmFtZScgOiAnTW96YW1iaXF1ZSBNZXRpY2FsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ05BRCcsICduYW1lJyA6ICdOYW1pYmlhIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdOR04nLCAnbmFtZScgOiAnTmlnZXJpYSBOYWlyYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdOSU8nLCAnbmFtZScgOiAnTmljYXJhZ3VhIENvcmRvYmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTk9LJywgJ25hbWUnIDogJ05vcndheSBLcm9uZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdOUFInLCAnbmFtZScgOiAnTmVwYWwgUnVwZWUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnTlpEJywgJ25hbWUnIDogJ05ldyBaZWFsYW5kIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdPTVInLCAnbmFtZScgOiAnT21hbiBSaWFsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1BBQicsICduYW1lJyA6ICdQYW5hbWEgQmFsYm9hJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1BFTicsICduYW1lJyA6ICdQZXJ1IE51ZXZvIFNvbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdQR0snLCAnbmFtZScgOiAnUGFwdWEgTmV3IEd1aW5lYSBLaW5hJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1BIUCcsICduYW1lJyA6ICdQaGlsaXBwaW5lcyBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1BLUicsICduYW1lJyA6ICdQYWtpc3RhbiBSdXBlZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdQTE4nLCAnbmFtZScgOiAnUG9sYW5kIFpsb3R5J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1BZRycsICduYW1lJyA6ICdQYXJhZ3VheSBHdWFyYW5pJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1FBUicsICduYW1lJyA6ICdRYXRhciBSaXlhbCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdST04nLCAnbmFtZScgOiAnUm9tYW5pYSBOZXcgTGV1J30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1JTRCcsICduYW1lJyA6ICdTZXJiaWEgRGluYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnUlVCJywgJ25hbWUnIDogJ1J1c3NpYSBSdWJsZSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdSV0YnLCAnbmFtZScgOiAnUndhbmRhIEZyYW5jJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NBUicsICduYW1lJyA6ICdTYXVkaSBBcmFiaWEgUml5YWwnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU0JEJywgJ25hbWUnIDogJ1NvbG9tb24gSXNsYW5kcyBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU0NSJywgJ25hbWUnIDogJ1NleWNoZWxsZXMgUnVwZWUnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU0RHJywgJ25hbWUnIDogJ1N1ZGFuIFBvdW5kJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NFSycsICduYW1lJyA6ICdTd2VkZW4gS3JvbmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU0dEJywgJ25hbWUnIDogJ1NpbmdhcG9yZSBEb2xsYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU0hQJywgJ25hbWUnIDogJ1NhaW50IEhlbGVuYSBQb3VuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTTEwnLCAnbmFtZScgOiAnU2llcnJhIExlb25lIExlb25lJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NPUycsICduYW1lJyA6ICdTb21hbGlhIFNoaWxsaW5nJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NQTCcsICduYW1lJyA6ICdTZWJvcmdhIEx1aWdpbm8nfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU1JEJywgJ25hbWUnIDogJ1N1cmluYW1lIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTVEQnLCAnbmFtZScgOiAnU8OjbyBUb23DqSBhbmQgUHLDrW5jaXBlIERvYnJhJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1NWQycsICduYW1lJyA6ICdFbCBTYWx2YWRvciBDb2xvbid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdTWVAnLCAnbmFtZScgOiAnU3lyaWEgUG91bmQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnU1pMJywgJ25hbWUnIDogJ1N3YXppbGFuZCBMaWxhbmdlbmknfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVEhCJywgJ25hbWUnIDogJ1RoYWlsYW5kIEJhaHQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVEpTJywgJ25hbWUnIDogJ1RhamlraXN0YW4gU29tb25pJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1RNVCcsICduYW1lJyA6ICdUdXJrbWVuaXN0YW4gTWFuYXQnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVE5EJywgJ25hbWUnIDogJ1R1bmlzaWEgRGluYXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVE9QJywgJ25hbWUnIDogJ1RvbmdhIFBhXFwnYW5nYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdUUlknLCAnbmFtZScgOiAnVHVya2V5IExpcmEnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVFREJywgJ25hbWUnIDogJ1RyaW5pZGFkIGFuZCBUb2JhZ28gRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1RWRCcsICduYW1lJyA6ICdUdXZhbHUgRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1RXRCcsICduYW1lJyA6ICdUYWl3YW4gTmV3IERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdUWlMnLCAnbmFtZScgOiAnVGFuemFuaWEgU2hpbGxpbmcnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVUFIJywgJ25hbWUnIDogJ1VrcmFpbmUgSHJ5dm5pYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdVR1gnLCAnbmFtZScgOiAnVWdhbmRhIFNoaWxsaW5nJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1VTRCcsICduYW1lJyA6ICdVbml0ZWQgU3RhdGVzIERvbGxhcid9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdVWVUnLCAnbmFtZScgOiAnVXJ1Z3VheSBQZXNvJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1VaUycsICduYW1lJyA6ICdVemJla2lzdGFuIFNvbSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdWRUYnLCAnbmFtZScgOiAnVmVuZXp1ZWxhIEJvbGl2YXInfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVk5EJywgJ25hbWUnIDogJ1ZpZXQgTmFtIERvbmcnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnVlVWJywgJ25hbWUnIDogJ1ZhbnVhdHUgVmF0dSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdXU1QnLCAnbmFtZScgOiAnU2Ftb2EgVGFsYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdYQUYnLCAnbmFtZScgOiAnQ29tbXVuYXV0w6kgRmluYW5jacOocmUgQWZyaWNhaW5lIChCRUFDKSBDRkEgRnJhbmMgQkVBQyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdYQ0QnLCAnbmFtZScgOiAnRWFzdCBDYXJpYmJlYW4gRG9sbGFyJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1hEUicsICduYW1lJyA6ICdJbnRlcm5hdGlvbmFsIE1vbmV0YXJ5IEZ1bmQgKElNRikgU3BlY2lhbCBEcmF3aW5nIFJpZ2h0cyd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdYT0YnLCAnbmFtZScgOiAnQ29tbXVuYXV0w6kgRmluYW5jacOocmUgQWZyaWNhaW5lIChCQ0VBTykgRnJhbmMnfSxcbiAgICAgICAgICAgIHsnY29kZScgOiAnWFBGJywgJ25hbWUnIDogJ0NvbXB0b2lycyBGcmFuw6dhaXMgZHUgUGFjaWZpcXVlIChDRlApIEZyYW5jJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1lFUicsICduYW1lJyA6ICdZZW1lbiBSaWFsJ30sXG4gICAgICAgICAgICB7J2NvZGUnIDogJ1pBUicsICduYW1lJyA6ICdTb3V0aCBBZnJpY2EgUmFuZCd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdaTVcnLCAnbmFtZScgOiAnWmFtYmlhIEt3YWNoYSd9LFxuICAgICAgICAgICAgeydjb2RlJyA6ICdaV0QnLCAnbmFtZScgOiAnWmltYmFid2UgRG9sbGFyJ31cbiAgICAgICAgXVxuICAgIH07XG5cbiAgICB2YXIgb19oYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG4gICAgdmFyIG9fa2V5cyA9IChPYmplY3Qua2V5cyB8fCBmdW5jdGlvbihvYmopIHtcbiAgICAgIHZhciByZXN1bHQgPSBbXTtcbiAgICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgaWYgKG9faGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIHtcbiAgICAgICAgICByZXN1bHQucHVzaChrZXkpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSk7XG5cbiAgICBmdW5jdGlvbiBfY29weU9iamVjdChzb3VyY2UsIHRhcmdldCkge1xuICAgICAgdmFyIGtleXMgPSBvX2tleXMoc291cmNlKTtcbiAgICAgIHZhciBrZXk7XG5cbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0ga2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAga2V5ID0ga2V5c1tpXTtcbiAgICAgICAgdGFyZ2V0W2tleV0gPSBzb3VyY2Vba2V5XSB8fCB0YXJnZXRba2V5XTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfY29weUFycmF5KHNvdXJjZSwgdGFyZ2V0KSB7XG4gICAgICBmb3IgKHZhciBpID0gMCwgbCA9IHNvdXJjZS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdGFyZ2V0W2ldID0gc291cmNlW2ldO1xuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNvcHlPYmplY3Qoc291cmNlLCBfdGFyZ2V0KSB7XG4gICAgICAgIHZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheShzb3VyY2UpO1xuICAgICAgICB2YXIgdGFyZ2V0ID0gX3RhcmdldCB8fCAoaXNBcnJheSA/IG5ldyBBcnJheShzb3VyY2UubGVuZ3RoKSA6IHt9KTtcblxuICAgICAgICBpZiAoaXNBcnJheSkge1xuICAgICAgICAgIF9jb3B5QXJyYXkoc291cmNlLCB0YXJnZXQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIF9jb3B5T2JqZWN0KHNvdXJjZSwgdGFyZ2V0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0YXJnZXQ7XG4gICAgfVxuXG4gICAgLyoqIEdldCB0aGUgZGF0YSBiYXNlZCBvbiBrZXkqKi9cbiAgICBDaGFuY2UucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIHJldHVybiBjb3B5T2JqZWN0KGRhdGFbbmFtZV0pO1xuICAgIH07XG5cbiAgICAvLyBNYWMgQWRkcmVzc1xuICAgIENoYW5jZS5wcm90b3R5cGUubWFjX2FkZHJlc3MgPSBmdW5jdGlvbihvcHRpb25zKXtcbiAgICAgICAgLy8gdHlwaWNhbGx5IG1hYyBhZGRyZXNzZXMgYXJlIHNlcGFyYXRlZCBieSBcIjpcIlxuICAgICAgICAvLyBob3dldmVyIHRoZXkgY2FuIGFsc28gYmUgc2VwYXJhdGVkIGJ5IFwiLVwiXG4gICAgICAgIC8vIHRoZSBuZXR3b3JrIHZhcmlhbnQgdXNlcyBhIGRvdCBldmVyeSBmb3VydGggYnl0ZVxuXG4gICAgICAgIG9wdGlvbnMgPSBpbml0T3B0aW9ucyhvcHRpb25zKTtcbiAgICAgICAgaWYoIW9wdGlvbnMuc2VwYXJhdG9yKSB7XG4gICAgICAgICAgICBvcHRpb25zLnNlcGFyYXRvciA9ICBvcHRpb25zLm5ldHdvcmtWZXJzaW9uID8gXCIuXCIgOiBcIjpcIjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBtYWNfcG9vbD1cIkFCQ0RFRjEyMzQ1Njc4OTBcIixcbiAgICAgICAgICAgIG1hYyA9IFwiXCI7XG4gICAgICAgIGlmKCFvcHRpb25zLm5ldHdvcmtWZXJzaW9uKSB7XG4gICAgICAgICAgICBtYWMgPSB0aGlzLm4odGhpcy5zdHJpbmcsIDYsIHsgcG9vbDogbWFjX3Bvb2wsIGxlbmd0aDoyIH0pLmpvaW4ob3B0aW9ucy5zZXBhcmF0b3IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbWFjID0gdGhpcy5uKHRoaXMuc3RyaW5nLCAzLCB7IHBvb2w6IG1hY19wb29sLCBsZW5ndGg6NCB9KS5qb2luKG9wdGlvbnMuc2VwYXJhdG9yKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBtYWM7XG4gICAgfTtcblxuICAgIENoYW5jZS5wcm90b3R5cGUubm9ybWFsID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgICAgICAgb3B0aW9ucyA9IGluaXRPcHRpb25zKG9wdGlvbnMsIHttZWFuIDogMCwgZGV2IDogMX0pO1xuXG4gICAgICAgIC8vIFRoZSBNYXJzYWdsaWEgUG9sYXIgbWV0aG9kXG4gICAgICAgIHZhciBzLCB1LCB2LCBub3JtLFxuICAgICAgICAgICAgbWVhbiA9IG9wdGlvbnMubWVhbixcbiAgICAgICAgICAgIGRldiA9IG9wdGlvbnMuZGV2O1xuXG4gICAgICAgIGRvIHtcbiAgICAgICAgICAgIC8vIFUgYW5kIFYgYXJlIGZyb20gdGhlIHVuaWZvcm0gZGlzdHJpYnV0aW9uIG9uICgtMSwgMSlcbiAgICAgICAgICAgIHUgPSB0aGlzLnJhbmRvbSgpICogMiAtIDE7XG4gICAgICAgICAgICB2ID0gdGhpcy5yYW5kb20oKSAqIDIgLSAxO1xuXG4gICAgICAgICAgICBzID0gdSAqIHUgKyB2ICogdjtcbiAgICAgICAgfSB3aGlsZSAocyA+PSAxKTtcblxuICAgICAgICAvLyBDb21wdXRlIHRoZSBzdGFuZGFyZCBub3JtYWwgdmFyaWF0ZVxuICAgICAgICBub3JtID0gdSAqIE1hdGguc3FydCgtMiAqIE1hdGgubG9nKHMpIC8gcyk7XG5cbiAgICAgICAgLy8gU2hhcGUgYW5kIHNjYWxlXG4gICAgICAgIHJldHVybiBkZXYgKiBub3JtICsgbWVhbjtcbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS5yYWRpbyA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIC8vIEluaXRpYWwgTGV0dGVyIChUeXBpY2FsbHkgRGVzaWduYXRlZCBieSBTaWRlIG9mIE1pc3Npc3NpcHBpIFJpdmVyKVxuICAgICAgICBvcHRpb25zID0gaW5pdE9wdGlvbnMob3B0aW9ucywge3NpZGUgOiBcIj9cIn0pO1xuICAgICAgICB2YXIgZmwgPSBcIlwiO1xuICAgICAgICBzd2l0Y2ggKG9wdGlvbnMuc2lkZS50b0xvd2VyQ2FzZSgpKSB7XG4gICAgICAgIGNhc2UgXCJlYXN0XCI6XG4gICAgICAgIGNhc2UgXCJlXCI6XG4gICAgICAgICAgICBmbCA9IFwiV1wiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgXCJ3ZXN0XCI6XG4gICAgICAgIGNhc2UgXCJ3XCI6XG4gICAgICAgICAgICBmbCA9IFwiS1wiO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBmbCA9IHRoaXMuY2hhcmFjdGVyKHtwb29sOiBcIktXXCJ9KTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGZsICsgdGhpcy5jaGFyYWN0ZXIoe2FscGhhOiB0cnVlLCBjYXNpbmc6IFwidXBwZXJcIn0pICtcbiAgICAgICAgICAgICAgICB0aGlzLmNoYXJhY3Rlcih7YWxwaGE6IHRydWUsIGNhc2luZzogXCJ1cHBlclwifSkgK1xuICAgICAgICAgICAgICAgIHRoaXMuY2hhcmFjdGVyKHthbHBoYTogdHJ1ZSwgY2FzaW5nOiBcInVwcGVyXCJ9KTtcbiAgICB9O1xuXG4gICAgLy8gU2V0IHRoZSBkYXRhIGFzIGtleSBhbmQgZGF0YSBvciB0aGUgZGF0YSBtYXBcbiAgICBDaGFuY2UucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChuYW1lLCB2YWx1ZXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICBkYXRhW25hbWVdID0gdmFsdWVzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGF0YSA9IGNvcHlPYmplY3QobmFtZSwgZGF0YSk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgQ2hhbmNlLnByb3RvdHlwZS50diA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJhZGlvKG9wdGlvbnMpO1xuICAgIH07XG5cbiAgICAvLyBJRCBudW1iZXIgZm9yIEJyYXppbCBjb21wYW5pZXNcbiAgICBDaGFuY2UucHJvdG90eXBlLmNucGogPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBuID0gdGhpcy5uKHRoaXMubmF0dXJhbCwgOCwgeyBtYXg6IDkgfSk7XG4gICAgICAgIHZhciBkMSA9IDIrbls3XSo2K25bNl0qNytuWzVdKjgrbls0XSo5K25bM10qMituWzJdKjMrblsxXSo0K25bMF0qNTtcbiAgICAgICAgZDEgPSAxMSAtIChkMSAlIDExKTtcbiAgICAgICAgaWYgKGQxPj0xMCl7XG4gICAgICAgICAgICBkMSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgdmFyIGQyID0gZDEqMiszK25bN10qNytuWzZdKjgrbls1XSo5K25bNF0qMituWzNdKjMrblsyXSo0K25bMV0qNStuWzBdKjY7XG4gICAgICAgIGQyID0gMTEgLSAoZDIgJSAxMSk7XG4gICAgICAgIGlmIChkMj49MTApe1xuICAgICAgICAgICAgZDIgPSAwO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiAnJytuWzBdK25bMV0rJy4nK25bMl0rblszXStuWzRdKycuJytuWzVdK25bNl0rbls3XSsnLzAwMDEtJytkMStkMjtcbiAgICB9O1xuXG4gICAgLy8gLS0gRW5kIE1pc2NlbGxhbmVvdXMgLS1cblxuICAgIENoYW5jZS5wcm90b3R5cGUubWVyc2VubmVfdHdpc3RlciA9IGZ1bmN0aW9uIChzZWVkKSB7XG4gICAgICAgIHJldHVybiBuZXcgTWVyc2VubmVUd2lzdGVyKHNlZWQpO1xuICAgIH07XG5cbiAgICBDaGFuY2UucHJvdG90eXBlLmJsdWVpbXBfbWQ1ID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gbmV3IEJsdWVJbXBNRDUoKTtcbiAgICB9O1xuXG4gICAgLy8gTWVyc2VubmUgVHdpc3RlciBmcm9tIGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL2JhbmtzZWFuLzMwMDQ5NFxuICAgIHZhciBNZXJzZW5uZVR3aXN0ZXIgPSBmdW5jdGlvbiAoc2VlZCkge1xuICAgICAgICBpZiAoc2VlZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBrZXB0IHJhbmRvbSBudW1iZXIgc2FtZSBzaXplIGFzIHRpbWUgdXNlZCBwcmV2aW91c2x5IHRvIGVuc3VyZSBubyB1bmV4cGVjdGVkIHJlc3VsdHMgZG93bnN0cmVhbVxuICAgICAgICAgICAgc2VlZCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSpNYXRoLnBvdygxMCwxMykpO1xuICAgICAgICB9XG4gICAgICAgIC8qIFBlcmlvZCBwYXJhbWV0ZXJzICovXG4gICAgICAgIHRoaXMuTiA9IDYyNDtcbiAgICAgICAgdGhpcy5NID0gMzk3O1xuICAgICAgICB0aGlzLk1BVFJJWF9BID0gMHg5OTA4YjBkZjsgICAvKiBjb25zdGFudCB2ZWN0b3IgYSAqL1xuICAgICAgICB0aGlzLlVQUEVSX01BU0sgPSAweDgwMDAwMDAwOyAvKiBtb3N0IHNpZ25pZmljYW50IHctciBiaXRzICovXG4gICAgICAgIHRoaXMuTE9XRVJfTUFTSyA9IDB4N2ZmZmZmZmY7IC8qIGxlYXN0IHNpZ25pZmljYW50IHIgYml0cyAqL1xuXG4gICAgICAgIHRoaXMubXQgPSBuZXcgQXJyYXkodGhpcy5OKTsgLyogdGhlIGFycmF5IGZvciB0aGUgc3RhdGUgdmVjdG9yICovXG4gICAgICAgIHRoaXMubXRpID0gdGhpcy5OICsgMTsgLyogbXRpPT1OICsgMSBtZWFucyBtdFtOXSBpcyBub3QgaW5pdGlhbGl6ZWQgKi9cblxuICAgICAgICB0aGlzLmluaXRfZ2VucmFuZChzZWVkKTtcbiAgICB9O1xuXG4gICAgLyogaW5pdGlhbGl6ZXMgbXRbTl0gd2l0aCBhIHNlZWQgKi9cbiAgICBNZXJzZW5uZVR3aXN0ZXIucHJvdG90eXBlLmluaXRfZ2VucmFuZCA9IGZ1bmN0aW9uIChzKSB7XG4gICAgICAgIHRoaXMubXRbMF0gPSBzID4+PiAwO1xuICAgICAgICBmb3IgKHRoaXMubXRpID0gMTsgdGhpcy5tdGkgPCB0aGlzLk47IHRoaXMubXRpKyspIHtcbiAgICAgICAgICAgIHMgPSB0aGlzLm10W3RoaXMubXRpIC0gMV0gXiAodGhpcy5tdFt0aGlzLm10aSAtIDFdID4+PiAzMCk7XG4gICAgICAgICAgICB0aGlzLm10W3RoaXMubXRpXSA9ICgoKCgocyAmIDB4ZmZmZjAwMDApID4+PiAxNikgKiAxODEyNDMzMjUzKSA8PCAxNikgKyAocyAmIDB4MDAwMGZmZmYpICogMTgxMjQzMzI1MykgKyB0aGlzLm10aTtcbiAgICAgICAgICAgIC8qIFNlZSBLbnV0aCBUQU9DUCBWb2wyLiAzcmQgRWQuIFAuMTA2IGZvciBtdWx0aXBsaWVyLiAqL1xuICAgICAgICAgICAgLyogSW4gdGhlIHByZXZpb3VzIHZlcnNpb25zLCBNU0JzIG9mIHRoZSBzZWVkIGFmZmVjdCAgICovXG4gICAgICAgICAgICAvKiBvbmx5IE1TQnMgb2YgdGhlIGFycmF5IG10W10uICAgICAgICAgICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIC8qIDIwMDIvMDEvMDkgbW9kaWZpZWQgYnkgTWFrb3RvIE1hdHN1bW90byAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5tdFt0aGlzLm10aV0gPj4+PSAwO1xuICAgICAgICAgICAgLyogZm9yID4zMiBiaXQgbWFjaGluZXMgKi9cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvKiBpbml0aWFsaXplIGJ5IGFuIGFycmF5IHdpdGggYXJyYXktbGVuZ3RoICovXG4gICAgLyogaW5pdF9rZXkgaXMgdGhlIGFycmF5IGZvciBpbml0aWFsaXppbmcga2V5cyAqL1xuICAgIC8qIGtleV9sZW5ndGggaXMgaXRzIGxlbmd0aCAqL1xuICAgIC8qIHNsaWdodCBjaGFuZ2UgZm9yIEMrKywgMjAwNC8yLzI2ICovXG4gICAgTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5pbml0X2J5X2FycmF5ID0gZnVuY3Rpb24gKGluaXRfa2V5LCBrZXlfbGVuZ3RoKSB7XG4gICAgICAgIHZhciBpID0gMSwgaiA9IDAsIGssIHM7XG4gICAgICAgIHRoaXMuaW5pdF9nZW5yYW5kKDE5NjUwMjE4KTtcbiAgICAgICAgayA9ICh0aGlzLk4gPiBrZXlfbGVuZ3RoID8gdGhpcy5OIDoga2V5X2xlbmd0aCk7XG4gICAgICAgIGZvciAoOyBrOyBrLS0pIHtcbiAgICAgICAgICAgIHMgPSB0aGlzLm10W2kgLSAxXSBeICh0aGlzLm10W2kgLSAxXSA+Pj4gMzApO1xuICAgICAgICAgICAgdGhpcy5tdFtpXSA9ICh0aGlzLm10W2ldIF4gKCgoKChzICYgMHhmZmZmMDAwMCkgPj4+IDE2KSAqIDE2NjQ1MjUpIDw8IDE2KSArICgocyAmIDB4MDAwMGZmZmYpICogMTY2NDUyNSkpKSArIGluaXRfa2V5W2pdICsgajsgLyogbm9uIGxpbmVhciAqL1xuICAgICAgICAgICAgdGhpcy5tdFtpXSA+Pj49IDA7IC8qIGZvciBXT1JEU0laRSA+IDMyIG1hY2hpbmVzICovXG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgICBqKys7XG4gICAgICAgICAgICBpZiAoaSA+PSB0aGlzLk4pIHsgdGhpcy5tdFswXSA9IHRoaXMubXRbdGhpcy5OIC0gMV07IGkgPSAxOyB9XG4gICAgICAgICAgICBpZiAoaiA+PSBrZXlfbGVuZ3RoKSB7IGogPSAwOyB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChrID0gdGhpcy5OIC0gMTsgazsgay0tKSB7XG4gICAgICAgICAgICBzID0gdGhpcy5tdFtpIC0gMV0gXiAodGhpcy5tdFtpIC0gMV0gPj4+IDMwKTtcbiAgICAgICAgICAgIHRoaXMubXRbaV0gPSAodGhpcy5tdFtpXSBeICgoKCgocyAmIDB4ZmZmZjAwMDApID4+PiAxNikgKiAxNTY2MDgzOTQxKSA8PCAxNikgKyAocyAmIDB4MDAwMGZmZmYpICogMTU2NjA4Mzk0MSkpIC0gaTsgLyogbm9uIGxpbmVhciAqL1xuICAgICAgICAgICAgdGhpcy5tdFtpXSA+Pj49IDA7IC8qIGZvciBXT1JEU0laRSA+IDMyIG1hY2hpbmVzICovXG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgICBpZiAoaSA+PSB0aGlzLk4pIHsgdGhpcy5tdFswXSA9IHRoaXMubXRbdGhpcy5OIC0gMV07IGkgPSAxOyB9XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLm10WzBdID0gMHg4MDAwMDAwMDsgLyogTVNCIGlzIDE7IGFzc3VyaW5nIG5vbi16ZXJvIGluaXRpYWwgYXJyYXkgKi9cbiAgICB9O1xuXG4gICAgLyogZ2VuZXJhdGVzIGEgcmFuZG9tIG51bWJlciBvbiBbMCwweGZmZmZmZmZmXS1pbnRlcnZhbCAqL1xuICAgIE1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuZ2VucmFuZF9pbnQzMiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIHk7XG4gICAgICAgIHZhciBtYWcwMSA9IG5ldyBBcnJheSgweDAsIHRoaXMuTUFUUklYX0EpO1xuICAgICAgICAvKiBtYWcwMVt4XSA9IHggKiBNQVRSSVhfQSAgZm9yIHg9MCwxICovXG5cbiAgICAgICAgaWYgKHRoaXMubXRpID49IHRoaXMuTikgeyAvKiBnZW5lcmF0ZSBOIHdvcmRzIGF0IG9uZSB0aW1lICovXG4gICAgICAgICAgICB2YXIga2s7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLm10aSA9PT0gdGhpcy5OICsgMSkgeyAgIC8qIGlmIGluaXRfZ2VucmFuZCgpIGhhcyBub3QgYmVlbiBjYWxsZWQsICovXG4gICAgICAgICAgICAgICAgdGhpcy5pbml0X2dlbnJhbmQoNTQ4OSk7IC8qIGEgZGVmYXVsdCBpbml0aWFsIHNlZWQgaXMgdXNlZCAqL1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChrayA9IDA7IGtrIDwgdGhpcy5OIC0gdGhpcy5NOyBraysrKSB7XG4gICAgICAgICAgICAgICAgeSA9ICh0aGlzLm10W2trXSZ0aGlzLlVQUEVSX01BU0spfCh0aGlzLm10W2trICsgMV0mdGhpcy5MT1dFUl9NQVNLKTtcbiAgICAgICAgICAgICAgICB0aGlzLm10W2trXSA9IHRoaXMubXRba2sgKyB0aGlzLk1dIF4gKHkgPj4+IDEpIF4gbWFnMDFbeSAmIDB4MV07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKDtrayA8IHRoaXMuTiAtIDE7IGtrKyspIHtcbiAgICAgICAgICAgICAgICB5ID0gKHRoaXMubXRba2tdJnRoaXMuVVBQRVJfTUFTSyl8KHRoaXMubXRba2sgKyAxXSZ0aGlzLkxPV0VSX01BU0spO1xuICAgICAgICAgICAgICAgIHRoaXMubXRba2tdID0gdGhpcy5tdFtrayArICh0aGlzLk0gLSB0aGlzLk4pXSBeICh5ID4+PiAxKSBeIG1hZzAxW3kgJiAweDFdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgeSA9ICh0aGlzLm10W3RoaXMuTiAtIDFdJnRoaXMuVVBQRVJfTUFTSyl8KHRoaXMubXRbMF0mdGhpcy5MT1dFUl9NQVNLKTtcbiAgICAgICAgICAgIHRoaXMubXRbdGhpcy5OIC0gMV0gPSB0aGlzLm10W3RoaXMuTSAtIDFdIF4gKHkgPj4+IDEpIF4gbWFnMDFbeSAmIDB4MV07XG5cbiAgICAgICAgICAgIHRoaXMubXRpID0gMDtcbiAgICAgICAgfVxuXG4gICAgICAgIHkgPSB0aGlzLm10W3RoaXMubXRpKytdO1xuXG4gICAgICAgIC8qIFRlbXBlcmluZyAqL1xuICAgICAgICB5IF49ICh5ID4+PiAxMSk7XG4gICAgICAgIHkgXj0gKHkgPDwgNykgJiAweDlkMmM1NjgwO1xuICAgICAgICB5IF49ICh5IDw8IDE1KSAmIDB4ZWZjNjAwMDA7XG4gICAgICAgIHkgXj0gKHkgPj4+IDE4KTtcblxuICAgICAgICByZXR1cm4geSA+Pj4gMDtcbiAgICB9O1xuXG4gICAgLyogZ2VuZXJhdGVzIGEgcmFuZG9tIG51bWJlciBvbiBbMCwweDdmZmZmZmZmXS1pbnRlcnZhbCAqL1xuICAgIE1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuZ2VucmFuZF9pbnQzMSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLmdlbnJhbmRfaW50MzIoKSA+Pj4gMSk7XG4gICAgfTtcblxuICAgIC8qIGdlbmVyYXRlcyBhIHJhbmRvbSBudW1iZXIgb24gWzAsMV0tcmVhbC1pbnRlcnZhbCAqL1xuICAgIE1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuZ2VucmFuZF9yZWFsMSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuZ2VucmFuZF9pbnQzMigpICogKDEuMCAvIDQyOTQ5NjcyOTUuMCk7XG4gICAgICAgIC8qIGRpdmlkZWQgYnkgMl4zMi0xICovXG4gICAgfTtcblxuICAgIC8qIGdlbmVyYXRlcyBhIHJhbmRvbSBudW1iZXIgb24gWzAsMSktcmVhbC1pbnRlcnZhbCAqL1xuICAgIE1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUucmFuZG9tID0gZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5nZW5yYW5kX2ludDMyKCkgKiAoMS4wIC8gNDI5NDk2NzI5Ni4wKTtcbiAgICAgICAgLyogZGl2aWRlZCBieSAyXjMyICovXG4gICAgfTtcblxuICAgIC8qIGdlbmVyYXRlcyBhIHJhbmRvbSBudW1iZXIgb24gKDAsMSktcmVhbC1pbnRlcnZhbCAqL1xuICAgIE1lcnNlbm5lVHdpc3Rlci5wcm90b3R5cGUuZ2VucmFuZF9yZWFsMyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLmdlbnJhbmRfaW50MzIoKSArIDAuNSkgKiAoMS4wIC8gNDI5NDk2NzI5Ni4wKTtcbiAgICAgICAgLyogZGl2aWRlZCBieSAyXjMyICovXG4gICAgfTtcblxuICAgIC8qIGdlbmVyYXRlcyBhIHJhbmRvbSBudW1iZXIgb24gWzAsMSkgd2l0aCA1My1iaXQgcmVzb2x1dGlvbiovXG4gICAgTWVyc2VubmVUd2lzdGVyLnByb3RvdHlwZS5nZW5yYW5kX3JlczUzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgYSA9IHRoaXMuZ2VucmFuZF9pbnQzMigpPj4+NSwgYiA9IHRoaXMuZ2VucmFuZF9pbnQzMigpPj4+NjtcbiAgICAgICAgcmV0dXJuIChhICogNjcxMDg4NjQuMCArIGIpICogKDEuMCAvIDkwMDcxOTkyNTQ3NDA5OTIuMCk7XG4gICAgfTtcblxuICAgIC8vIEJsdWVJbXAgTUQ1IGhhc2hpbmcgYWxnb3JpdGhtIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2JsdWVpbXAvSmF2YVNjcmlwdC1NRDVcbiAgICB2YXIgQmx1ZUltcE1ENSA9IGZ1bmN0aW9uICgpIHt9O1xuXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUuVkVSU0lPTiA9ICcxLjAuMSc7XG5cbiAgICAvKlxuICAgICogQWRkIGludGVnZXJzLCB3cmFwcGluZyBhdCAyXjMyLiBUaGlzIHVzZXMgMTYtYml0IG9wZXJhdGlvbnMgaW50ZXJuYWxseVxuICAgICogdG8gd29yayBhcm91bmQgYnVncyBpbiBzb21lIEpTIGludGVycHJldGVycy5cbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLnNhZmVfYWRkID0gZnVuY3Rpb24gc2FmZV9hZGQoeCwgeSkge1xuICAgICAgICB2YXIgbHN3ID0gKHggJiAweEZGRkYpICsgKHkgJiAweEZGRkYpLFxuICAgICAgICAgICAgbXN3ID0gKHggPj4gMTYpICsgKHkgPj4gMTYpICsgKGxzdyA+PiAxNik7XG4gICAgICAgIHJldHVybiAobXN3IDw8IDE2KSB8IChsc3cgJiAweEZGRkYpO1xuICAgIH07XG5cbiAgICAvKlxuICAgICogQml0d2lzZSByb3RhdGUgYSAzMi1iaXQgbnVtYmVyIHRvIHRoZSBsZWZ0LlxuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUuYml0X3JvbGwgPSBmdW5jdGlvbiAobnVtLCBjbnQpIHtcbiAgICAgICAgcmV0dXJuIChudW0gPDwgY250KSB8IChudW0gPj4+ICgzMiAtIGNudCkpO1xuICAgIH07XG5cbiAgICAvKlxuICAgICogVGhlc2UgZnVuY3Rpb25zIGltcGxlbWVudCB0aGUgZml2ZSBiYXNpYyBvcGVyYXRpb25zIHRoZSBhbGdvcml0aG0gdXNlcy5cbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLm1kNV9jbW4gPSBmdW5jdGlvbiAocSwgYSwgYiwgeCwgcywgdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5zYWZlX2FkZCh0aGlzLmJpdF9yb2xsKHRoaXMuc2FmZV9hZGQodGhpcy5zYWZlX2FkZChhLCBxKSwgdGhpcy5zYWZlX2FkZCh4LCB0KSksIHMpLCBiKTtcbiAgICB9O1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLm1kNV9mZiA9IGZ1bmN0aW9uIChhLCBiLCBjLCBkLCB4LCBzLCB0KSB7XG4gICAgICAgIHJldHVybiB0aGlzLm1kNV9jbW4oKGIgJiBjKSB8ICgofmIpICYgZCksIGEsIGIsIHgsIHMsIHQpO1xuICAgIH07XG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUubWQ1X2dnID0gZnVuY3Rpb24gKGEsIGIsIGMsIGQsIHgsIHMsIHQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubWQ1X2NtbigoYiAmIGQpIHwgKGMgJiAofmQpKSwgYSwgYiwgeCwgcywgdCk7XG4gICAgfTtcbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5tZDVfaGggPSBmdW5jdGlvbiAoYSwgYiwgYywgZCwgeCwgcywgdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tZDVfY21uKGIgXiBjIF4gZCwgYSwgYiwgeCwgcywgdCk7XG4gICAgfTtcbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5tZDVfaWkgPSBmdW5jdGlvbiAoYSwgYiwgYywgZCwgeCwgcywgdCkge1xuICAgICAgICByZXR1cm4gdGhpcy5tZDVfY21uKGMgXiAoYiB8ICh+ZCkpLCBhLCBiLCB4LCBzLCB0KTtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIENhbGN1bGF0ZSB0aGUgTUQ1IG9mIGFuIGFycmF5IG9mIGxpdHRsZS1lbmRpYW4gd29yZHMsIGFuZCBhIGJpdCBsZW5ndGguXG4gICAgKi9cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5iaW5sX21kNSA9IGZ1bmN0aW9uICh4LCBsZW4pIHtcbiAgICAgICAgLyogYXBwZW5kIHBhZGRpbmcgKi9cbiAgICAgICAgeFtsZW4gPj4gNV0gfD0gMHg4MCA8PCAobGVuICUgMzIpO1xuICAgICAgICB4WygoKGxlbiArIDY0KSA+Pj4gOSkgPDwgNCkgKyAxNF0gPSBsZW47XG5cbiAgICAgICAgdmFyIGksIG9sZGEsIG9sZGIsIG9sZGMsIG9sZGQsXG4gICAgICAgICAgICBhID0gIDE3MzI1ODQxOTMsXG4gICAgICAgICAgICBiID0gLTI3MTczMzg3OSxcbiAgICAgICAgICAgIGMgPSAtMTczMjU4NDE5NCxcbiAgICAgICAgICAgIGQgPSAgMjcxNzMzODc4O1xuXG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCB4Lmxlbmd0aDsgaSArPSAxNikge1xuICAgICAgICAgICAgb2xkYSA9IGE7XG4gICAgICAgICAgICBvbGRiID0gYjtcbiAgICAgICAgICAgIG9sZGMgPSBjO1xuICAgICAgICAgICAgb2xkZCA9IGQ7XG5cbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9mZihhLCBiLCBjLCBkLCB4W2ldLCAgICAgICA3LCAtNjgwODc2OTM2KTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9mZihkLCBhLCBiLCBjLCB4W2kgKyAgMV0sIDEyLCAtMzg5NTY0NTg2KTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9mZihjLCBkLCBhLCBiLCB4W2kgKyAgMl0sIDE3LCAgNjA2MTA1ODE5KTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9mZihiLCBjLCBkLCBhLCB4W2kgKyAgM10sIDIyLCAtMTA0NDUyNTMzMCk7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfZmYoYSwgYiwgYywgZCwgeFtpICsgIDRdLCAgNywgLTE3NjQxODg5Nyk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfZmYoZCwgYSwgYiwgYywgeFtpICsgIDVdLCAxMiwgIDEyMDAwODA0MjYpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2ZmKGMsIGQsIGEsIGIsIHhbaSArICA2XSwgMTcsIC0xNDczMjMxMzQxKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9mZihiLCBjLCBkLCBhLCB4W2kgKyAgN10sIDIyLCAtNDU3MDU5ODMpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2ZmKGEsIGIsIGMsIGQsIHhbaSArICA4XSwgIDcsICAxNzcwMDM1NDE2KTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9mZihkLCBhLCBiLCBjLCB4W2kgKyAgOV0sIDEyLCAtMTk1ODQxNDQxNyk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfZmYoYywgZCwgYSwgYiwgeFtpICsgMTBdLCAxNywgLTQyMDYzKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9mZihiLCBjLCBkLCBhLCB4W2kgKyAxMV0sIDIyLCAtMTk5MDQwNDE2Mik7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfZmYoYSwgYiwgYywgZCwgeFtpICsgMTJdLCAgNywgIDE4MDQ2MDM2ODIpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2ZmKGQsIGEsIGIsIGMsIHhbaSArIDEzXSwgMTIsIC00MDM0MTEwMSk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfZmYoYywgZCwgYSwgYiwgeFtpICsgMTRdLCAxNywgLTE1MDIwMDIyOTApO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2ZmKGIsIGMsIGQsIGEsIHhbaSArIDE1XSwgMjIsICAxMjM2NTM1MzI5KTtcblxuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2dnKGEsIGIsIGMsIGQsIHhbaSArICAxXSwgIDUsIC0xNjU3OTY1MTApO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2dnKGQsIGEsIGIsIGMsIHhbaSArICA2XSwgIDksIC0xMDY5NTAxNjMyKTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9nZyhjLCBkLCBhLCBiLCB4W2kgKyAxMV0sIDE0LCAgNjQzNzE3NzEzKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9nZyhiLCBjLCBkLCBhLCB4W2ldLCAgICAgIDIwLCAtMzczODk3MzAyKTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9nZyhhLCBiLCBjLCBkLCB4W2kgKyAgNV0sICA1LCAtNzAxNTU4NjkxKTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9nZyhkLCBhLCBiLCBjLCB4W2kgKyAxMF0sICA5LCAgMzgwMTYwODMpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2dnKGMsIGQsIGEsIGIsIHhbaSArIDE1XSwgMTQsIC02NjA0NzgzMzUpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2dnKGIsIGMsIGQsIGEsIHhbaSArICA0XSwgMjAsIC00MDU1Mzc4NDgpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2dnKGEsIGIsIGMsIGQsIHhbaSArICA5XSwgIDUsICA1Njg0NDY0MzgpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2dnKGQsIGEsIGIsIGMsIHhbaSArIDE0XSwgIDksIC0xMDE5ODAzNjkwKTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9nZyhjLCBkLCBhLCBiLCB4W2kgKyAgM10sIDE0LCAtMTg3MzYzOTYxKTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9nZyhiLCBjLCBkLCBhLCB4W2kgKyAgOF0sIDIwLCAgMTE2MzUzMTUwMSk7XG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfZ2coYSwgYiwgYywgZCwgeFtpICsgMTNdLCAgNSwgLTE0NDQ2ODE0NjcpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2dnKGQsIGEsIGIsIGMsIHhbaSArICAyXSwgIDksIC01MTQwMzc4NCk7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfZ2coYywgZCwgYSwgYiwgeFtpICsgIDddLCAxNCwgIDE3MzUzMjg0NzMpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2dnKGIsIGMsIGQsIGEsIHhbaSArIDEyXSwgMjAsIC0xOTI2NjA3NzM0KTtcblxuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSArICA1XSwgIDQsIC0zNzg1NTgpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2hoKGQsIGEsIGIsIGMsIHhbaSArICA4XSwgMTEsIC0yMDIyNTc0NDYzKTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9oaChjLCBkLCBhLCBiLCB4W2kgKyAxMV0sIDE2LCAgMTgzOTAzMDU2Mik7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfaGgoYiwgYywgZCwgYSwgeFtpICsgMTRdLCAyMywgLTM1MzA5NTU2KTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9oaChhLCBiLCBjLCBkLCB4W2kgKyAgMV0sICA0LCAtMTUzMDk5MjA2MCk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfaGgoZCwgYSwgYiwgYywgeFtpICsgIDRdLCAxMSwgIDEyNzI4OTMzNTMpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2hoKGMsIGQsIGEsIGIsIHhbaSArICA3XSwgMTYsIC0xNTU0OTc2MzIpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2hoKGIsIGMsIGQsIGEsIHhbaSArIDEwXSwgMjMsIC0xMDk0NzMwNjQwKTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9oaChhLCBiLCBjLCBkLCB4W2kgKyAxM10sICA0LCAgNjgxMjc5MTc0KTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9oaChkLCBhLCBiLCBjLCB4W2ldLCAgICAgIDExLCAtMzU4NTM3MjIyKTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9oaChjLCBkLCBhLCBiLCB4W2kgKyAgM10sIDE2LCAtNzIyNTIxOTc5KTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9oaChiLCBjLCBkLCBhLCB4W2kgKyAgNl0sIDIzLCAgNzYwMjkxODkpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2hoKGEsIGIsIGMsIGQsIHhbaSArICA5XSwgIDQsIC02NDAzNjQ0ODcpO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2hoKGQsIGEsIGIsIGMsIHhbaSArIDEyXSwgMTEsIC00MjE4MTU4MzUpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2hoKGMsIGQsIGEsIGIsIHhbaSArIDE1XSwgMTYsICA1MzA3NDI1MjApO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2hoKGIsIGMsIGQsIGEsIHhbaSArICAyXSwgMjMsIC05OTUzMzg2NTEpO1xuXG4gICAgICAgICAgICBhID0gdGhpcy5tZDVfaWkoYSwgYiwgYywgZCwgeFtpXSwgICAgICAgNiwgLTE5ODYzMDg0NCk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfaWkoZCwgYSwgYiwgYywgeFtpICsgIDddLCAxMCwgIDExMjY4OTE0MTUpO1xuICAgICAgICAgICAgYyA9IHRoaXMubWQ1X2lpKGMsIGQsIGEsIGIsIHhbaSArIDE0XSwgMTUsIC0xNDE2MzU0OTA1KTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9paShiLCBjLCBkLCBhLCB4W2kgKyAgNV0sIDIxLCAtNTc0MzQwNTUpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2lpKGEsIGIsIGMsIGQsIHhbaSArIDEyXSwgIDYsICAxNzAwNDg1NTcxKTtcbiAgICAgICAgICAgIGQgPSB0aGlzLm1kNV9paShkLCBhLCBiLCBjLCB4W2kgKyAgM10sIDEwLCAtMTg5NDk4NjYwNik7XG4gICAgICAgICAgICBjID0gdGhpcy5tZDVfaWkoYywgZCwgYSwgYiwgeFtpICsgMTBdLCAxNSwgLTEwNTE1MjMpO1xuICAgICAgICAgICAgYiA9IHRoaXMubWQ1X2lpKGIsIGMsIGQsIGEsIHhbaSArICAxXSwgMjEsIC0yMDU0OTIyNzk5KTtcbiAgICAgICAgICAgIGEgPSB0aGlzLm1kNV9paShhLCBiLCBjLCBkLCB4W2kgKyAgOF0sICA2LCAgMTg3MzMxMzM1OSk7XG4gICAgICAgICAgICBkID0gdGhpcy5tZDVfaWkoZCwgYSwgYiwgYywgeFtpICsgMTVdLCAxMCwgLTMwNjExNzQ0KTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9paShjLCBkLCBhLCBiLCB4W2kgKyAgNl0sIDE1LCAtMTU2MDE5ODM4MCk7XG4gICAgICAgICAgICBiID0gdGhpcy5tZDVfaWkoYiwgYywgZCwgYSwgeFtpICsgMTNdLCAyMSwgIDEzMDkxNTE2NDkpO1xuICAgICAgICAgICAgYSA9IHRoaXMubWQ1X2lpKGEsIGIsIGMsIGQsIHhbaSArICA0XSwgIDYsIC0xNDU1MjMwNzApO1xuICAgICAgICAgICAgZCA9IHRoaXMubWQ1X2lpKGQsIGEsIGIsIGMsIHhbaSArIDExXSwgMTAsIC0xMTIwMjEwMzc5KTtcbiAgICAgICAgICAgIGMgPSB0aGlzLm1kNV9paShjLCBkLCBhLCBiLCB4W2kgKyAgMl0sIDE1LCAgNzE4Nzg3MjU5KTtcbiAgICAgICAgICAgIGIgPSB0aGlzLm1kNV9paShiLCBjLCBkLCBhLCB4W2kgKyAgOV0sIDIxLCAtMzQzNDg1NTUxKTtcblxuICAgICAgICAgICAgYSA9IHRoaXMuc2FmZV9hZGQoYSwgb2xkYSk7XG4gICAgICAgICAgICBiID0gdGhpcy5zYWZlX2FkZChiLCBvbGRiKTtcbiAgICAgICAgICAgIGMgPSB0aGlzLnNhZmVfYWRkKGMsIG9sZGMpO1xuICAgICAgICAgICAgZCA9IHRoaXMuc2FmZV9hZGQoZCwgb2xkZCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIFthLCBiLCBjLCBkXTtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIENvbnZlcnQgYW4gYXJyYXkgb2YgbGl0dGxlLWVuZGlhbiB3b3JkcyB0byBhIHN0cmluZ1xuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUuYmlubDJyc3RyID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIHZhciBpLFxuICAgICAgICAgICAgb3V0cHV0ID0gJyc7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGggKiAzMjsgaSArPSA4KSB7XG4gICAgICAgICAgICBvdXRwdXQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgoaW5wdXRbaSA+PiA1XSA+Pj4gKGkgJSAzMikpICYgMHhGRik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIENvbnZlcnQgYSByYXcgc3RyaW5nIHRvIGFuIGFycmF5IG9mIGxpdHRsZS1lbmRpYW4gd29yZHNcbiAgICAqIENoYXJhY3RlcnMgPjI1NSBoYXZlIHRoZWlyIGhpZ2gtYnl0ZSBzaWxlbnRseSBpZ25vcmVkLlxuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUucnN0cjJiaW5sID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIHZhciBpLFxuICAgICAgICAgICAgb3V0cHV0ID0gW107XG4gICAgICAgIG91dHB1dFsoaW5wdXQubGVuZ3RoID4+IDIpIC0gMV0gPSB1bmRlZmluZWQ7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBvdXRwdXQubGVuZ3RoOyBpICs9IDEpIHtcbiAgICAgICAgICAgIG91dHB1dFtpXSA9IDA7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGlucHV0Lmxlbmd0aCAqIDg7IGkgKz0gOCkge1xuICAgICAgICAgICAgb3V0cHV0W2kgPj4gNV0gfD0gKGlucHV0LmNoYXJDb2RlQXQoaSAvIDgpICYgMHhGRikgPDwgKGkgJSAzMik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG91dHB1dDtcbiAgICB9O1xuXG4gICAgLypcbiAgICAqIENhbGN1bGF0ZSB0aGUgTUQ1IG9mIGEgcmF3IHN0cmluZ1xuICAgICovXG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUucnN0cl9tZDUgPSBmdW5jdGlvbiAocykge1xuICAgICAgICByZXR1cm4gdGhpcy5iaW5sMnJzdHIodGhpcy5iaW5sX21kNSh0aGlzLnJzdHIyYmlubChzKSwgcy5sZW5ndGggKiA4KSk7XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiBDYWxjdWxhdGUgdGhlIEhNQUMtTUQ1LCBvZiBhIGtleSBhbmQgc29tZSBkYXRhIChyYXcgc3RyaW5ncylcbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLnJzdHJfaG1hY19tZDUgPSBmdW5jdGlvbiAoa2V5LCBkYXRhKSB7XG4gICAgICAgIHZhciBpLFxuICAgICAgICAgICAgYmtleSA9IHRoaXMucnN0cjJiaW5sKGtleSksXG4gICAgICAgICAgICBpcGFkID0gW10sXG4gICAgICAgICAgICBvcGFkID0gW10sXG4gICAgICAgICAgICBoYXNoO1xuICAgICAgICBpcGFkWzE1XSA9IG9wYWRbMTVdID0gdW5kZWZpbmVkO1xuICAgICAgICBpZiAoYmtleS5sZW5ndGggPiAxNikge1xuICAgICAgICAgICAgYmtleSA9IHRoaXMuYmlubF9tZDUoYmtleSwga2V5Lmxlbmd0aCAqIDgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCAxNjsgaSArPSAxKSB7XG4gICAgICAgICAgICBpcGFkW2ldID0gYmtleVtpXSBeIDB4MzYzNjM2MzY7XG4gICAgICAgICAgICBvcGFkW2ldID0gYmtleVtpXSBeIDB4NUM1QzVDNUM7XG4gICAgICAgIH1cbiAgICAgICAgaGFzaCA9IHRoaXMuYmlubF9tZDUoaXBhZC5jb25jYXQodGhpcy5yc3RyMmJpbmwoZGF0YSkpLCA1MTIgKyBkYXRhLmxlbmd0aCAqIDgpO1xuICAgICAgICByZXR1cm4gdGhpcy5iaW5sMnJzdHIodGhpcy5iaW5sX21kNShvcGFkLmNvbmNhdChoYXNoKSwgNTEyICsgMTI4KSk7XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiBDb252ZXJ0IGEgcmF3IHN0cmluZyB0byBhIGhleCBzdHJpbmdcbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLnJzdHIyaGV4ID0gZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIHZhciBoZXhfdGFiID0gJzAxMjM0NTY3ODlhYmNkZWYnLFxuICAgICAgICAgICAgb3V0cHV0ID0gJycsXG4gICAgICAgICAgICB4LFxuICAgICAgICAgICAgaTtcbiAgICAgICAgZm9yIChpID0gMDsgaSA8IGlucHV0Lmxlbmd0aDsgaSArPSAxKSB7XG4gICAgICAgICAgICB4ID0gaW5wdXQuY2hhckNvZGVBdChpKTtcbiAgICAgICAgICAgIG91dHB1dCArPSBoZXhfdGFiLmNoYXJBdCgoeCA+Pj4gNCkgJiAweDBGKSArXG4gICAgICAgICAgICAgICAgaGV4X3RhYi5jaGFyQXQoeCAmIDB4MEYpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvdXRwdXQ7XG4gICAgfTtcblxuICAgIC8qXG4gICAgKiBFbmNvZGUgYSBzdHJpbmcgYXMgdXRmLThcbiAgICAqL1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLnN0cjJyc3RyX3V0ZjggPSBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICAgICAgcmV0dXJuIHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChpbnB1dCkpO1xuICAgIH07XG5cbiAgICAvKlxuICAgICogVGFrZSBzdHJpbmcgYXJndW1lbnRzIGFuZCByZXR1cm4gZWl0aGVyIHJhdyBvciBoZXggZW5jb2RlZCBzdHJpbmdzXG4gICAgKi9cbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5yYXdfbWQ1ID0gZnVuY3Rpb24gKHMpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucnN0cl9tZDUodGhpcy5zdHIycnN0cl91dGY4KHMpKTtcbiAgICB9O1xuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLmhleF9tZDUgPSBmdW5jdGlvbiAocykge1xuICAgICAgICByZXR1cm4gdGhpcy5yc3RyMmhleCh0aGlzLnJhd19tZDUocykpO1xuICAgIH07XG4gICAgQmx1ZUltcE1ENS5wcm90b3R5cGUucmF3X2htYWNfbWQ1ID0gZnVuY3Rpb24gKGssIGQpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMucnN0cl9obWFjX21kNSh0aGlzLnN0cjJyc3RyX3V0ZjgoayksIHRoaXMuc3RyMnJzdHJfdXRmOChkKSk7XG4gICAgfTtcbiAgICBCbHVlSW1wTUQ1LnByb3RvdHlwZS5oZXhfaG1hY19tZDUgPSBmdW5jdGlvbiAoaywgZCkge1xuICAgICAgICByZXR1cm4gdGhpcy5yc3RyMmhleCh0aGlzLnJhd19obWFjX21kNShrLCBkKSk7XG4gICAgfTtcblxuICAgIEJsdWVJbXBNRDUucHJvdG90eXBlLm1kNSA9IGZ1bmN0aW9uIChzdHJpbmcsIGtleSwgcmF3KSB7XG4gICAgICAgIGlmICgha2V5KSB7XG4gICAgICAgICAgICBpZiAoIXJhdykge1xuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmhleF9tZDUoc3RyaW5nKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmF3X21kNShzdHJpbmcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFyYXcpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmhleF9obWFjX21kNShrZXksIHN0cmluZyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5yYXdfaG1hY19tZDUoa2V5LCBzdHJpbmcpO1xuICAgIH07XG5cbiAgICAvLyBDb21tb25KUyBtb2R1bGVcbiAgICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIGlmICh0eXBlb2YgbW9kdWxlICE9PSAndW5kZWZpbmVkJyAmJiBtb2R1bGUuZXhwb3J0cykge1xuICAgICAgICAgICAgZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gQ2hhbmNlO1xuICAgICAgICB9XG4gICAgICAgIGV4cG9ydHMuQ2hhbmNlID0gQ2hhbmNlO1xuICAgIH1cblxuICAgIC8vIFJlZ2lzdGVyIGFzIGFuIGFub255bW91cyBBTUQgbW9kdWxlXG4gICAgaWYgKHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICBkZWZpbmUoW10sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBDaGFuY2U7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIGlmIHRoZXJlIGlzIGEgaW1wb3J0c1NjcmlwcyBvYmplY3QgZGVmaW5lIGNoYW5jZSBmb3Igd29ya2VyXG4gICAgaWYgKHR5cGVvZiBpbXBvcnRTY3JpcHRzICE9PSAndW5kZWZpbmVkJykge1xuICAgICAgICBjaGFuY2UgPSBuZXcgQ2hhbmNlKCk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUgaXMgYSB3aW5kb3cgb2JqZWN0LCB0aGF0IGF0IGxlYXN0IGhhcyBhIGRvY3VtZW50IHByb3BlcnR5LFxuICAgIC8vIGluc3RhbnRpYXRlIGFuZCBkZWZpbmUgY2hhbmNlIG9uIHRoZSB3aW5kb3dcbiAgICBpZiAodHlwZW9mIHdpbmRvdyA9PT0gXCJvYmplY3RcIiAmJiB0eXBlb2Ygd2luZG93LmRvY3VtZW50ID09PSBcIm9iamVjdFwiKSB7XG4gICAgICAgIHdpbmRvdy5DaGFuY2UgPSBDaGFuY2U7XG4gICAgICAgIHdpbmRvdy5jaGFuY2UgPSBuZXcgQ2hhbmNlKCk7XG4gICAgfVxufSkoKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuZXhwb3J0cy5fX2VzTW9kdWxlID0gdHJ1ZTtcblxudmFyIF9jcmVhdGVDbGFzcyA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSkoKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfVxuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxudmFyIF9zZWxlY3QgPSByZXF1aXJlKCdzZWxlY3QnKTtcblxudmFyIF9zZWxlY3QyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfc2VsZWN0KTtcblxuLyoqXG4gKiBJbm5lciBjbGFzcyB3aGljaCBwZXJmb3JtcyBzZWxlY3Rpb24gZnJvbSBlaXRoZXIgYHRleHRgIG9yIGB0YXJnZXRgXG4gKiBwcm9wZXJ0aWVzIGFuZCB0aGVuIGV4ZWN1dGVzIGNvcHkgb3IgY3V0IG9wZXJhdGlvbnMuXG4gKi9cblxudmFyIENsaXBib2FyZEFjdGlvbiA9IChmdW5jdGlvbiAoKSB7XG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICAgKi9cblxuICAgIGZ1bmN0aW9uIENsaXBib2FyZEFjdGlvbihvcHRpb25zKSB7XG4gICAgICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBDbGlwYm9hcmRBY3Rpb24pO1xuXG4gICAgICAgIHRoaXMucmVzb2x2ZU9wdGlvbnMob3B0aW9ucyk7XG4gICAgICAgIHRoaXMuaW5pdFNlbGVjdGlvbigpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIERlZmluZXMgYmFzZSBwcm9wZXJ0aWVzIHBhc3NlZCBmcm9tIGNvbnN0cnVjdG9yLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICovXG5cbiAgICBDbGlwYm9hcmRBY3Rpb24ucHJvdG90eXBlLnJlc29sdmVPcHRpb25zID0gZnVuY3Rpb24gcmVzb2x2ZU9wdGlvbnMoKSB7XG4gICAgICAgIHZhciBvcHRpb25zID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8ge30gOiBhcmd1bWVudHNbMF07XG5cbiAgICAgICAgdGhpcy5hY3Rpb24gPSBvcHRpb25zLmFjdGlvbjtcbiAgICAgICAgdGhpcy5lbWl0dGVyID0gb3B0aW9ucy5lbWl0dGVyO1xuICAgICAgICB0aGlzLnRhcmdldCA9IG9wdGlvbnMudGFyZ2V0O1xuICAgICAgICB0aGlzLnRleHQgPSBvcHRpb25zLnRleHQ7XG4gICAgICAgIHRoaXMudHJpZ2dlciA9IG9wdGlvbnMudHJpZ2dlcjtcblxuICAgICAgICB0aGlzLnNlbGVjdGVkVGV4dCA9ICcnO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBEZWNpZGVzIHdoaWNoIHNlbGVjdGlvbiBzdHJhdGVneSBpcyBnb2luZyB0byBiZSBhcHBsaWVkIGJhc2VkXG4gICAgICogb24gdGhlIGV4aXN0ZW5jZSBvZiBgdGV4dGAgYW5kIGB0YXJnZXRgIHByb3BlcnRpZXMuXG4gICAgICovXG5cbiAgICBDbGlwYm9hcmRBY3Rpb24ucHJvdG90eXBlLmluaXRTZWxlY3Rpb24gPSBmdW5jdGlvbiBpbml0U2VsZWN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy50ZXh0ICYmIHRoaXMudGFyZ2V0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ011bHRpcGxlIGF0dHJpYnV0ZXMgZGVjbGFyZWQsIHVzZSBlaXRoZXIgXCJ0YXJnZXRcIiBvciBcInRleHRcIicpO1xuICAgICAgICB9IGVsc2UgaWYgKHRoaXMudGV4dCkge1xuICAgICAgICAgICAgdGhpcy5zZWxlY3RGYWtlKCk7XG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy50YXJnZXQpIHtcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0VGFyZ2V0KCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ01pc3NpbmcgcmVxdWlyZWQgYXR0cmlidXRlcywgdXNlIGVpdGhlciBcInRhcmdldFwiIG9yIFwidGV4dFwiJyk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogQ3JlYXRlcyBhIGZha2UgdGV4dGFyZWEgZWxlbWVudCwgc2V0cyBpdHMgdmFsdWUgZnJvbSBgdGV4dGAgcHJvcGVydHksXG4gICAgICogYW5kIG1ha2VzIGEgc2VsZWN0aW9uIG9uIGl0LlxuICAgICAqL1xuXG4gICAgQ2xpcGJvYXJkQWN0aW9uLnByb3RvdHlwZS5zZWxlY3RGYWtlID0gZnVuY3Rpb24gc2VsZWN0RmFrZSgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgICAgICB0aGlzLnJlbW92ZUZha2UoKTtcblxuICAgICAgICB0aGlzLmZha2VIYW5kbGVyID0gZG9jdW1lbnQuYm9keS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5yZW1vdmVGYWtlKCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuZmFrZUVsZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCd0ZXh0YXJlYScpO1xuICAgICAgICB0aGlzLmZha2VFbGVtLnN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICAgICAgdGhpcy5mYWtlRWxlbS5zdHlsZS5sZWZ0ID0gJy05OTk5cHgnO1xuICAgICAgICB0aGlzLmZha2VFbGVtLnN0eWxlLnRvcCA9ICh3aW5kb3cucGFnZVlPZmZzZXQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcCkgKyAncHgnO1xuICAgICAgICB0aGlzLmZha2VFbGVtLnNldEF0dHJpYnV0ZSgncmVhZG9ubHknLCAnJyk7XG4gICAgICAgIHRoaXMuZmFrZUVsZW0udmFsdWUgPSB0aGlzLnRleHQ7XG5cbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0aGlzLmZha2VFbGVtKTtcblxuICAgICAgICB0aGlzLnNlbGVjdGVkVGV4dCA9IF9zZWxlY3QyWydkZWZhdWx0J10odGhpcy5mYWtlRWxlbSk7XG4gICAgICAgIHRoaXMuY29weVRleHQoKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogT25seSByZW1vdmVzIHRoZSBmYWtlIGVsZW1lbnQgYWZ0ZXIgYW5vdGhlciBjbGljayBldmVudCwgdGhhdCB3YXlcbiAgICAgKiBhIHVzZXIgY2FuIGhpdCBgQ3RybCtDYCB0byBjb3B5IGJlY2F1c2Ugc2VsZWN0aW9uIHN0aWxsIGV4aXN0cy5cbiAgICAgKi9cblxuICAgIENsaXBib2FyZEFjdGlvbi5wcm90b3R5cGUucmVtb3ZlRmFrZSA9IGZ1bmN0aW9uIHJlbW92ZUZha2UoKSB7XG4gICAgICAgIGlmICh0aGlzLmZha2VIYW5kbGVyKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2NsaWNrJyk7XG4gICAgICAgICAgICB0aGlzLmZha2VIYW5kbGVyID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLmZha2VFbGVtKSB7XG4gICAgICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKHRoaXMuZmFrZUVsZW0pO1xuICAgICAgICAgICAgdGhpcy5mYWtlRWxlbSA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogU2VsZWN0cyB0aGUgY29udGVudCBmcm9tIGVsZW1lbnQgcGFzc2VkIG9uIGB0YXJnZXRgIHByb3BlcnR5LlxuICAgICAqL1xuXG4gICAgQ2xpcGJvYXJkQWN0aW9uLnByb3RvdHlwZS5zZWxlY3RUYXJnZXQgPSBmdW5jdGlvbiBzZWxlY3RUYXJnZXQoKSB7XG4gICAgICAgIHRoaXMuc2VsZWN0ZWRUZXh0ID0gX3NlbGVjdDJbJ2RlZmF1bHQnXSh0aGlzLnRhcmdldCk7XG4gICAgICAgIHRoaXMuY29weVRleHQoKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRXhlY3V0ZXMgdGhlIGNvcHkgb3BlcmF0aW9uIGJhc2VkIG9uIHRoZSBjdXJyZW50IHNlbGVjdGlvbi5cbiAgICAgKi9cblxuICAgIENsaXBib2FyZEFjdGlvbi5wcm90b3R5cGUuY29weVRleHQgPSBmdW5jdGlvbiBjb3B5VGV4dCgpIHtcbiAgICAgICAgdmFyIHN1Y2NlZWRlZCA9IHVuZGVmaW5lZDtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgc3VjY2VlZGVkID0gZG9jdW1lbnQuZXhlY0NvbW1hbmQodGhpcy5hY3Rpb24pO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICAgIHN1Y2NlZWRlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5oYW5kbGVSZXN1bHQoc3VjY2VlZGVkKTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRmlyZXMgYW4gZXZlbnQgYmFzZWQgb24gdGhlIGNvcHkgb3BlcmF0aW9uIHJlc3VsdC5cbiAgICAgKiBAcGFyYW0ge0Jvb2xlYW59IHN1Y2NlZWRlZFxuICAgICAqL1xuXG4gICAgQ2xpcGJvYXJkQWN0aW9uLnByb3RvdHlwZS5oYW5kbGVSZXN1bHQgPSBmdW5jdGlvbiBoYW5kbGVSZXN1bHQoc3VjY2VlZGVkKSB7XG4gICAgICAgIGlmIChzdWNjZWVkZWQpIHtcbiAgICAgICAgICAgIHRoaXMuZW1pdHRlci5lbWl0KCdzdWNjZXNzJywge1xuICAgICAgICAgICAgICAgIGFjdGlvbjogdGhpcy5hY3Rpb24sXG4gICAgICAgICAgICAgICAgdGV4dDogdGhpcy5zZWxlY3RlZFRleHQsXG4gICAgICAgICAgICAgICAgdHJpZ2dlcjogdGhpcy50cmlnZ2VyLFxuICAgICAgICAgICAgICAgIGNsZWFyU2VsZWN0aW9uOiB0aGlzLmNsZWFyU2VsZWN0aW9uLmJpbmQodGhpcylcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhpcy5lbWl0dGVyLmVtaXQoJ2Vycm9yJywge1xuICAgICAgICAgICAgICAgIGFjdGlvbjogdGhpcy5hY3Rpb24sXG4gICAgICAgICAgICAgICAgdHJpZ2dlcjogdGhpcy50cmlnZ2VyLFxuICAgICAgICAgICAgICAgIGNsZWFyU2VsZWN0aW9uOiB0aGlzLmNsZWFyU2VsZWN0aW9uLmJpbmQodGhpcylcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgY3VycmVudCBzZWxlY3Rpb24gYW5kIGZvY3VzIGZyb20gYHRhcmdldGAgZWxlbWVudC5cbiAgICAgKi9cblxuICAgIENsaXBib2FyZEFjdGlvbi5wcm90b3R5cGUuY2xlYXJTZWxlY3Rpb24gPSBmdW5jdGlvbiBjbGVhclNlbGVjdGlvbigpIHtcbiAgICAgICAgaWYgKHRoaXMudGFyZ2V0KSB7XG4gICAgICAgICAgICB0aGlzLnRhcmdldC5ibHVyKCk7XG4gICAgICAgIH1cblxuICAgICAgICB3aW5kb3cuZ2V0U2VsZWN0aW9uKCkucmVtb3ZlQWxsUmFuZ2VzKCk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIFNldHMgdGhlIGBhY3Rpb25gIHRvIGJlIHBlcmZvcm1lZCB3aGljaCBjYW4gYmUgZWl0aGVyICdjb3B5JyBvciAnY3V0Jy5cbiAgICAgKiBAcGFyYW0ge1N0cmluZ30gYWN0aW9uXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBEZXN0cm95IGxpZmVjeWNsZS5cbiAgICAgKi9cblxuICAgIENsaXBib2FyZEFjdGlvbi5wcm90b3R5cGUuZGVzdHJveSA9IGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG4gICAgICAgIHRoaXMucmVtb3ZlRmFrZSgpO1xuICAgIH07XG5cbiAgICBfY3JlYXRlQ2xhc3MoQ2xpcGJvYXJkQWN0aW9uLCBbe1xuICAgICAgICBrZXk6ICdhY3Rpb24nLFxuICAgICAgICBzZXQ6IGZ1bmN0aW9uIHNldCgpIHtcbiAgICAgICAgICAgIHZhciBhY3Rpb24gPSBhcmd1bWVudHMubGVuZ3RoIDw9IDAgfHwgYXJndW1lbnRzWzBdID09PSB1bmRlZmluZWQgPyAnY29weScgOiBhcmd1bWVudHNbMF07XG5cbiAgICAgICAgICAgIHRoaXMuX2FjdGlvbiA9IGFjdGlvbjtcblxuICAgICAgICAgICAgaWYgKHRoaXMuX2FjdGlvbiAhPT0gJ2NvcHknICYmIHRoaXMuX2FjdGlvbiAhPT0gJ2N1dCcpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgXCJhY3Rpb25cIiB2YWx1ZSwgdXNlIGVpdGhlciBcImNvcHlcIiBvciBcImN1dFwiJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdldHMgdGhlIGBhY3Rpb25gIHByb3BlcnR5LlxuICAgICAgICAgKiBAcmV0dXJuIHtTdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl9hY3Rpb247XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogU2V0cyB0aGUgYHRhcmdldGAgcHJvcGVydHkgdXNpbmcgYW4gZWxlbWVudFxuICAgICAgICAgKiB0aGF0IHdpbGwgYmUgaGF2ZSBpdHMgY29udGVudCBjb3BpZWQuXG4gICAgICAgICAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gICAgICAgICAqL1xuICAgIH0sIHtcbiAgICAgICAga2V5OiAndGFyZ2V0JyxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiBzZXQodGFyZ2V0KSB7XG4gICAgICAgICAgICBpZiAodGFyZ2V0ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICBpZiAodGFyZ2V0ICYmIHR5cGVvZiB0YXJnZXQgPT09ICdvYmplY3QnICYmIHRhcmdldC5ub2RlVHlwZSA9PT0gMSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl90YXJnZXQgPSB0YXJnZXQ7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFwidGFyZ2V0XCIgdmFsdWUsIHVzZSBhIHZhbGlkIEVsZW1lbnQnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdldHMgdGhlIGB0YXJnZXRgIHByb3BlcnR5LlxuICAgICAgICAgKiBAcmV0dXJuIHtTdHJpbmd8SFRNTEVsZW1lbnR9XG4gICAgICAgICAqL1xuICAgICAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLl90YXJnZXQ7XG4gICAgICAgIH1cbiAgICB9XSk7XG5cbiAgICByZXR1cm4gQ2xpcGJvYXJkQWN0aW9uO1xufSkoKTtcblxuZXhwb3J0c1snZGVmYXVsdCddID0gQ2xpcGJvYXJkQWN0aW9uO1xubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzWydkZWZhdWx0J107IiwiJ3VzZSBzdHJpY3QnO1xuXG5leHBvcnRzLl9fZXNNb2R1bGUgPSB0cnVlO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyAnZGVmYXVsdCc6IG9iaiB9OyB9XG5cbmZ1bmN0aW9uIF9jbGFzc0NhbGxDaGVjayhpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uJyk7IH0gfVxuXG5mdW5jdGlvbiBfaW5oZXJpdHMoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIHsgaWYgKHR5cGVvZiBzdXBlckNsYXNzICE9PSAnZnVuY3Rpb24nICYmIHN1cGVyQ2xhc3MgIT09IG51bGwpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignU3VwZXIgZXhwcmVzc2lvbiBtdXN0IGVpdGhlciBiZSBudWxsIG9yIGEgZnVuY3Rpb24sIG5vdCAnICsgdHlwZW9mIHN1cGVyQ2xhc3MpOyB9IHN1YkNsYXNzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDbGFzcyAmJiBzdXBlckNsYXNzLnByb3RvdHlwZSwgeyBjb25zdHJ1Y3RvcjogeyB2YWx1ZTogc3ViQ2xhc3MsIGVudW1lcmFibGU6IGZhbHNlLCB3cml0YWJsZTogdHJ1ZSwgY29uZmlndXJhYmxlOiB0cnVlIH0gfSk7IGlmIChzdXBlckNsYXNzKSBPYmplY3Quc2V0UHJvdG90eXBlT2YgPyBPYmplY3Quc2V0UHJvdG90eXBlT2Yoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIDogc3ViQ2xhc3MuX19wcm90b19fID0gc3VwZXJDbGFzczsgfVxuXG52YXIgX2NsaXBib2FyZEFjdGlvbiA9IHJlcXVpcmUoJy4vY2xpcGJvYXJkLWFjdGlvbicpO1xuXG52YXIgX2NsaXBib2FyZEFjdGlvbjIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jbGlwYm9hcmRBY3Rpb24pO1xuXG52YXIgX3RpbnlFbWl0dGVyID0gcmVxdWlyZSgndGlueS1lbWl0dGVyJyk7XG5cbnZhciBfdGlueUVtaXR0ZXIyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfdGlueUVtaXR0ZXIpO1xuXG52YXIgX2dvb2RMaXN0ZW5lciA9IHJlcXVpcmUoJ2dvb2QtbGlzdGVuZXInKTtcblxudmFyIF9nb29kTGlzdGVuZXIyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZ29vZExpc3RlbmVyKTtcblxuLyoqXG4gKiBCYXNlIGNsYXNzIHdoaWNoIHRha2VzIG9uZSBvciBtb3JlIGVsZW1lbnRzLCBhZGRzIGV2ZW50IGxpc3RlbmVycyB0byB0aGVtLFxuICogYW5kIGluc3RhbnRpYXRlcyBhIG5ldyBgQ2xpcGJvYXJkQWN0aW9uYCBvbiBlYWNoIGNsaWNrLlxuICovXG5cbnZhciBDbGlwYm9hcmQgPSAoZnVuY3Rpb24gKF9FbWl0dGVyKSB7XG4gICAgX2luaGVyaXRzKENsaXBib2FyZCwgX0VtaXR0ZXIpO1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtTdHJpbmd8SFRNTEVsZW1lbnR8SFRNTENvbGxlY3Rpb258Tm9kZUxpc3R9IHRyaWdnZXJcbiAgICAgKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICAgICAqL1xuXG4gICAgZnVuY3Rpb24gQ2xpcGJvYXJkKHRyaWdnZXIsIG9wdGlvbnMpIHtcbiAgICAgICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIENsaXBib2FyZCk7XG5cbiAgICAgICAgX0VtaXR0ZXIuY2FsbCh0aGlzKTtcblxuICAgICAgICB0aGlzLnJlc29sdmVPcHRpb25zKG9wdGlvbnMpO1xuICAgICAgICB0aGlzLmxpc3RlbkNsaWNrKHRyaWdnZXIpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEhlbHBlciBmdW5jdGlvbiB0byByZXRyaWV2ZSBhdHRyaWJ1dGUgdmFsdWUuXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IHN1ZmZpeFxuICAgICAqIEBwYXJhbSB7RWxlbWVudH0gZWxlbWVudFxuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogRGVmaW5lcyBpZiBhdHRyaWJ1dGVzIHdvdWxkIGJlIHJlc29sdmVkIHVzaW5nIGludGVybmFsIHNldHRlciBmdW5jdGlvbnNcbiAgICAgKiBvciBjdXN0b20gZnVuY3Rpb25zIHRoYXQgd2VyZSBwYXNzZWQgaW4gdGhlIGNvbnN0cnVjdG9yLlxuICAgICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gICAgICovXG5cbiAgICBDbGlwYm9hcmQucHJvdG90eXBlLnJlc29sdmVPcHRpb25zID0gZnVuY3Rpb24gcmVzb2x2ZU9wdGlvbnMoKSB7XG4gICAgICAgIHZhciBvcHRpb25zID0gYXJndW1lbnRzLmxlbmd0aCA8PSAwIHx8IGFyZ3VtZW50c1swXSA9PT0gdW5kZWZpbmVkID8ge30gOiBhcmd1bWVudHNbMF07XG5cbiAgICAgICAgdGhpcy5hY3Rpb24gPSB0eXBlb2Ygb3B0aW9ucy5hY3Rpb24gPT09ICdmdW5jdGlvbicgPyBvcHRpb25zLmFjdGlvbiA6IHRoaXMuZGVmYXVsdEFjdGlvbjtcbiAgICAgICAgdGhpcy50YXJnZXQgPSB0eXBlb2Ygb3B0aW9ucy50YXJnZXQgPT09ICdmdW5jdGlvbicgPyBvcHRpb25zLnRhcmdldCA6IHRoaXMuZGVmYXVsdFRhcmdldDtcbiAgICAgICAgdGhpcy50ZXh0ID0gdHlwZW9mIG9wdGlvbnMudGV4dCA9PT0gJ2Z1bmN0aW9uJyA/IG9wdGlvbnMudGV4dCA6IHRoaXMuZGVmYXVsdFRleHQ7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIEFkZHMgYSBjbGljayBldmVudCBsaXN0ZW5lciB0byB0aGUgcGFzc2VkIHRyaWdnZXIuXG4gICAgICogQHBhcmFtIHtTdHJpbmd8SFRNTEVsZW1lbnR8SFRNTENvbGxlY3Rpb258Tm9kZUxpc3R9IHRyaWdnZXJcbiAgICAgKi9cblxuICAgIENsaXBib2FyZC5wcm90b3R5cGUubGlzdGVuQ2xpY2sgPSBmdW5jdGlvbiBsaXN0ZW5DbGljayh0cmlnZ2VyKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5saXN0ZW5lciA9IF9nb29kTGlzdGVuZXIyWydkZWZhdWx0J10odHJpZ2dlciwgJ2NsaWNrJywgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIHJldHVybiBfdGhpcy5vbkNsaWNrKGUpO1xuICAgICAgICB9KTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRGVmaW5lcyBhIG5ldyBgQ2xpcGJvYXJkQWN0aW9uYCBvbiBlYWNoIGNsaWNrIGV2ZW50LlxuICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgKi9cblxuICAgIENsaXBib2FyZC5wcm90b3R5cGUub25DbGljayA9IGZ1bmN0aW9uIG9uQ2xpY2soZSkge1xuICAgICAgICB2YXIgdHJpZ2dlciA9IGUuZGVsZWdhdGVUYXJnZXQgfHwgZS5jdXJyZW50VGFyZ2V0O1xuXG4gICAgICAgIGlmICh0aGlzLmNsaXBib2FyZEFjdGlvbikge1xuICAgICAgICAgICAgdGhpcy5jbGlwYm9hcmRBY3Rpb24gPSBudWxsO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5jbGlwYm9hcmRBY3Rpb24gPSBuZXcgX2NsaXBib2FyZEFjdGlvbjJbJ2RlZmF1bHQnXSh7XG4gICAgICAgICAgICBhY3Rpb246IHRoaXMuYWN0aW9uKHRyaWdnZXIpLFxuICAgICAgICAgICAgdGFyZ2V0OiB0aGlzLnRhcmdldCh0cmlnZ2VyKSxcbiAgICAgICAgICAgIHRleHQ6IHRoaXMudGV4dCh0cmlnZ2VyKSxcbiAgICAgICAgICAgIHRyaWdnZXI6IHRyaWdnZXIsXG4gICAgICAgICAgICBlbWl0dGVyOiB0aGlzXG4gICAgICAgIH0pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBEZWZhdWx0IGBhY3Rpb25gIGxvb2t1cCBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0ge0VsZW1lbnR9IHRyaWdnZXJcbiAgICAgKi9cblxuICAgIENsaXBib2FyZC5wcm90b3R5cGUuZGVmYXVsdEFjdGlvbiA9IGZ1bmN0aW9uIGRlZmF1bHRBY3Rpb24odHJpZ2dlcikge1xuICAgICAgICByZXR1cm4gZ2V0QXR0cmlidXRlVmFsdWUoJ2FjdGlvbicsIHRyaWdnZXIpO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiBEZWZhdWx0IGB0YXJnZXRgIGxvb2t1cCBmdW5jdGlvbi5cbiAgICAgKiBAcGFyYW0ge0VsZW1lbnR9IHRyaWdnZXJcbiAgICAgKi9cblxuICAgIENsaXBib2FyZC5wcm90b3R5cGUuZGVmYXVsdFRhcmdldCA9IGZ1bmN0aW9uIGRlZmF1bHRUYXJnZXQodHJpZ2dlcikge1xuICAgICAgICB2YXIgc2VsZWN0b3IgPSBnZXRBdHRyaWJ1dGVWYWx1ZSgndGFyZ2V0JywgdHJpZ2dlcik7XG5cbiAgICAgICAgaWYgKHNlbGVjdG9yKSB7XG4gICAgICAgICAgICByZXR1cm4gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihzZWxlY3Rvcik7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogRGVmYXVsdCBgdGV4dGAgbG9va3VwIGZ1bmN0aW9uLlxuICAgICAqIEBwYXJhbSB7RWxlbWVudH0gdHJpZ2dlclxuICAgICAqL1xuXG4gICAgQ2xpcGJvYXJkLnByb3RvdHlwZS5kZWZhdWx0VGV4dCA9IGZ1bmN0aW9uIGRlZmF1bHRUZXh0KHRyaWdnZXIpIHtcbiAgICAgICAgcmV0dXJuIGdldEF0dHJpYnV0ZVZhbHVlKCd0ZXh0JywgdHJpZ2dlcik7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIERlc3Ryb3kgbGlmZWN5Y2xlLlxuICAgICAqL1xuXG4gICAgQ2xpcGJvYXJkLnByb3RvdHlwZS5kZXN0cm95ID0gZnVuY3Rpb24gZGVzdHJveSgpIHtcbiAgICAgICAgdGhpcy5saXN0ZW5lci5kZXN0cm95KCk7XG5cbiAgICAgICAgaWYgKHRoaXMuY2xpcGJvYXJkQWN0aW9uKSB7XG4gICAgICAgICAgICB0aGlzLmNsaXBib2FyZEFjdGlvbi5kZXN0cm95KCk7XG4gICAgICAgICAgICB0aGlzLmNsaXBib2FyZEFjdGlvbiA9IG51bGw7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIENsaXBib2FyZDtcbn0pKF90aW55RW1pdHRlcjJbJ2RlZmF1bHQnXSk7XG5cbmZ1bmN0aW9uIGdldEF0dHJpYnV0ZVZhbHVlKHN1ZmZpeCwgZWxlbWVudCkge1xuICAgIHZhciBhdHRyaWJ1dGUgPSAnZGF0YS1jbGlwYm9hcmQtJyArIHN1ZmZpeDtcblxuICAgIGlmICghZWxlbWVudC5oYXNBdHRyaWJ1dGUoYXR0cmlidXRlKSkge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgcmV0dXJuIGVsZW1lbnQuZ2V0QXR0cmlidXRlKGF0dHJpYnV0ZSk7XG59XG5cbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IENsaXBib2FyZDtcbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0c1snZGVmYXVsdCddOyIsInZhciBtYXRjaGVzID0gcmVxdWlyZSgnbWF0Y2hlcy1zZWxlY3RvcicpXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChlbGVtZW50LCBzZWxlY3RvciwgY2hlY2tZb1NlbGYpIHtcclxuICB2YXIgcGFyZW50ID0gY2hlY2tZb1NlbGYgPyBlbGVtZW50IDogZWxlbWVudC5wYXJlbnROb2RlXHJcblxyXG4gIHdoaWxlIChwYXJlbnQgJiYgcGFyZW50ICE9PSBkb2N1bWVudCkge1xyXG4gICAgaWYgKG1hdGNoZXMocGFyZW50LCBzZWxlY3RvcikpIHJldHVybiBwYXJlbnQ7XHJcbiAgICBwYXJlbnQgPSBwYXJlbnQucGFyZW50Tm9kZVxyXG4gIH1cclxufVxyXG4iLCJ2YXIgY2xvc2VzdCA9IHJlcXVpcmUoJ2Nsb3Nlc3QnKTtcblxuLyoqXG4gKiBEZWxlZ2F0ZXMgZXZlbnQgdG8gYSBzZWxlY3Rvci5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsZW1lbnRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzZWxlY3RvclxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHVzZUNhcHR1cmVcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZnVuY3Rpb24gZGVsZWdhdGUoZWxlbWVudCwgc2VsZWN0b3IsIHR5cGUsIGNhbGxiYWNrLCB1c2VDYXB0dXJlKSB7XG4gICAgdmFyIGxpc3RlbmVyRm4gPSBsaXN0ZW5lci5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGxpc3RlbmVyRm4sIHVzZUNhcHR1cmUpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZGVzdHJveTogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgbGlzdGVuZXJGbiwgdXNlQ2FwdHVyZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbi8qKlxuICogRmluZHMgY2xvc2VzdCBtYXRjaCBhbmQgaW52b2tlcyBjYWxsYmFjay5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsZW1lbnRcbiAqIEBwYXJhbSB7U3RyaW5nfSBzZWxlY3RvclxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuZnVuY3Rpb24gbGlzdGVuZXIoZWxlbWVudCwgc2VsZWN0b3IsIHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgZS5kZWxlZ2F0ZVRhcmdldCA9IGNsb3Nlc3QoZS50YXJnZXQsIHNlbGVjdG9yLCB0cnVlKTtcblxuICAgICAgICBpZiAoZS5kZWxlZ2F0ZVRhcmdldCkge1xuICAgICAgICAgICAgY2FsbGJhY2suY2FsbChlbGVtZW50LCBlKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBkZWxlZ2F0ZTtcbiIsIi8qIVxuICogZG9jUmVhZHkgdjEuMC4zXG4gKiBDcm9zcyBicm93c2VyIERPTUNvbnRlbnRMb2FkZWQgZXZlbnQgZW1pdHRlclxuICogTUlUIGxpY2Vuc2VcbiAqL1xuXG4vKmpzaGludCBicm93c2VyOiB0cnVlLCBzdHJpY3Q6IHRydWUsIHVuZGVmOiB0cnVlLCB1bnVzZWQ6IHRydWUqL1xuLypnbG9iYWwgZGVmaW5lOiBmYWxzZSwgcmVxdWlyZTogZmFsc2UsIG1vZHVsZTogZmFsc2UgKi9cblxuKCBmdW5jdGlvbiggd2luZG93ICkge1xuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBkb2N1bWVudCA9IHdpbmRvdy5kb2N1bWVudDtcbi8vIGNvbGxlY3Rpb24gb2YgZnVuY3Rpb25zIHRvIGJlIHRyaWdnZXJlZCBvbiByZWFkeVxudmFyIHF1ZXVlID0gW107XG5cbmZ1bmN0aW9uIGRvY1JlYWR5KCBmbiApIHtcbiAgLy8gdGhyb3cgb3V0IG5vbi1mdW5jdGlvbnNcbiAgaWYgKCB0eXBlb2YgZm4gIT09ICdmdW5jdGlvbicgKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKCBkb2NSZWFkeS5pc1JlYWR5ICkge1xuICAgIC8vIHJlYWR5IG5vdywgaGl0IGl0XG4gICAgZm4oKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBxdWV1ZSBmdW5jdGlvbiB3aGVuIHJlYWR5XG4gICAgcXVldWUucHVzaCggZm4gKTtcbiAgfVxufVxuXG5kb2NSZWFkeS5pc1JlYWR5ID0gZmFsc2U7XG5cbi8vIHRyaWdnZXJlZCBvbiB2YXJpb3VzIGRvYyByZWFkeSBldmVudHNcbmZ1bmN0aW9uIGluaXQoIGV2ZW50ICkge1xuICAvLyBiYWlsIGlmIElFOCBkb2N1bWVudCBpcyBub3QgcmVhZHkganVzdCB5ZXRcbiAgdmFyIGlzSUU4Tm90UmVhZHkgPSBldmVudC50eXBlID09PSAncmVhZHlzdGF0ZWNoYW5nZScgJiYgZG9jdW1lbnQucmVhZHlTdGF0ZSAhPT0gJ2NvbXBsZXRlJztcbiAgaWYgKCBkb2NSZWFkeS5pc1JlYWR5IHx8IGlzSUU4Tm90UmVhZHkgKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGRvY1JlYWR5LmlzUmVhZHkgPSB0cnVlO1xuXG4gIC8vIHByb2Nlc3MgcXVldWVcbiAgZm9yICggdmFyIGk9MCwgbGVuID0gcXVldWUubGVuZ3RoOyBpIDwgbGVuOyBpKysgKSB7XG4gICAgdmFyIGZuID0gcXVldWVbaV07XG4gICAgZm4oKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBkZWZpbmVEb2NSZWFkeSggZXZlbnRpZSApIHtcbiAgZXZlbnRpZS5iaW5kKCBkb2N1bWVudCwgJ0RPTUNvbnRlbnRMb2FkZWQnLCBpbml0ICk7XG4gIGV2ZW50aWUuYmluZCggZG9jdW1lbnQsICdyZWFkeXN0YXRlY2hhbmdlJywgaW5pdCApO1xuICBldmVudGllLmJpbmQoIHdpbmRvdywgJ2xvYWQnLCBpbml0ICk7XG5cbiAgcmV0dXJuIGRvY1JlYWR5O1xufVxuXG4vLyB0cmFuc3BvcnRcbmlmICggdHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kICkge1xuICAvLyBBTURcbiAgLy8gaWYgUmVxdWlyZUpTLCB0aGVuIGRvYyBpcyBhbHJlYWR5IHJlYWR5XG4gIGRvY1JlYWR5LmlzUmVhZHkgPSB0eXBlb2YgcmVxdWlyZWpzID09PSAnZnVuY3Rpb24nO1xuICBkZWZpbmUoIFsgJ2V2ZW50aWUvZXZlbnRpZScgXSwgZGVmaW5lRG9jUmVhZHkgKTtcbn0gZWxzZSBpZiAoIHR5cGVvZiBleHBvcnRzID09PSAnb2JqZWN0JyApIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBkZWZpbmVEb2NSZWFkeSggcmVxdWlyZSgnZXZlbnRpZScpICk7XG59IGVsc2Uge1xuICAvLyBicm93c2VyIGdsb2JhbFxuICB3aW5kb3cuZG9jUmVhZHkgPSBkZWZpbmVEb2NSZWFkeSggd2luZG93LmV2ZW50aWUgKTtcbn1cblxufSkoIHdpbmRvdyApO1xuIiwiLyohXG4gKiBldmVudGllIHYxLjAuNlxuICogZXZlbnQgYmluZGluZyBoZWxwZXJcbiAqICAgZXZlbnRpZS5iaW5kKCBlbGVtLCAnY2xpY2snLCBteUZuIClcbiAqICAgZXZlbnRpZS51bmJpbmQoIGVsZW0sICdjbGljaycsIG15Rm4gKVxuICogTUlUIGxpY2Vuc2VcbiAqL1xuXG4vKmpzaGludCBicm93c2VyOiB0cnVlLCB1bmRlZjogdHJ1ZSwgdW51c2VkOiB0cnVlICovXG4vKmdsb2JhbCBkZWZpbmU6IGZhbHNlLCBtb2R1bGU6IGZhbHNlICovXG5cbiggZnVuY3Rpb24oIHdpbmRvdyApIHtcblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZG9jRWxlbSA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcblxudmFyIGJpbmQgPSBmdW5jdGlvbigpIHt9O1xuXG5mdW5jdGlvbiBnZXRJRUV2ZW50KCBvYmogKSB7XG4gIHZhciBldmVudCA9IHdpbmRvdy5ldmVudDtcbiAgLy8gYWRkIGV2ZW50LnRhcmdldFxuICBldmVudC50YXJnZXQgPSBldmVudC50YXJnZXQgfHwgZXZlbnQuc3JjRWxlbWVudCB8fCBvYmo7XG4gIHJldHVybiBldmVudDtcbn1cblxuaWYgKCBkb2NFbGVtLmFkZEV2ZW50TGlzdGVuZXIgKSB7XG4gIGJpbmQgPSBmdW5jdGlvbiggb2JqLCB0eXBlLCBmbiApIHtcbiAgICBvYmouYWRkRXZlbnRMaXN0ZW5lciggdHlwZSwgZm4sIGZhbHNlICk7XG4gIH07XG59IGVsc2UgaWYgKCBkb2NFbGVtLmF0dGFjaEV2ZW50ICkge1xuICBiaW5kID0gZnVuY3Rpb24oIG9iaiwgdHlwZSwgZm4gKSB7XG4gICAgb2JqWyB0eXBlICsgZm4gXSA9IGZuLmhhbmRsZUV2ZW50ID9cbiAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZXZlbnQgPSBnZXRJRUV2ZW50KCBvYmogKTtcbiAgICAgICAgZm4uaGFuZGxlRXZlbnQuY2FsbCggZm4sIGV2ZW50ICk7XG4gICAgICB9IDpcbiAgICAgIGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgZXZlbnQgPSBnZXRJRUV2ZW50KCBvYmogKTtcbiAgICAgICAgZm4uY2FsbCggb2JqLCBldmVudCApO1xuICAgICAgfTtcbiAgICBvYmouYXR0YWNoRXZlbnQoIFwib25cIiArIHR5cGUsIG9ialsgdHlwZSArIGZuIF0gKTtcbiAgfTtcbn1cblxudmFyIHVuYmluZCA9IGZ1bmN0aW9uKCkge307XG5cbmlmICggZG9jRWxlbS5yZW1vdmVFdmVudExpc3RlbmVyICkge1xuICB1bmJpbmQgPSBmdW5jdGlvbiggb2JqLCB0eXBlLCBmbiApIHtcbiAgICBvYmoucmVtb3ZlRXZlbnRMaXN0ZW5lciggdHlwZSwgZm4sIGZhbHNlICk7XG4gIH07XG59IGVsc2UgaWYgKCBkb2NFbGVtLmRldGFjaEV2ZW50ICkge1xuICB1bmJpbmQgPSBmdW5jdGlvbiggb2JqLCB0eXBlLCBmbiApIHtcbiAgICBvYmouZGV0YWNoRXZlbnQoIFwib25cIiArIHR5cGUsIG9ialsgdHlwZSArIGZuIF0gKTtcbiAgICB0cnkge1xuICAgICAgZGVsZXRlIG9ialsgdHlwZSArIGZuIF07XG4gICAgfSBjYXRjaCAoIGVyciApIHtcbiAgICAgIC8vIGNhbid0IGRlbGV0ZSB3aW5kb3cgb2JqZWN0IHByb3BlcnRpZXNcbiAgICAgIG9ialsgdHlwZSArIGZuIF0gPSB1bmRlZmluZWQ7XG4gICAgfVxuICB9O1xufVxuXG52YXIgZXZlbnRpZSA9IHtcbiAgYmluZDogYmluZCxcbiAgdW5iaW5kOiB1bmJpbmRcbn07XG5cbi8vIC0tLS0tIG1vZHVsZSBkZWZpbml0aW9uIC0tLS0tIC8vXG5cbmlmICggdHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kICkge1xuICAvLyBBTURcbiAgZGVmaW5lKCBldmVudGllICk7XG59IGVsc2UgaWYgKCB0eXBlb2YgZXhwb3J0cyA9PT0gJ29iamVjdCcgKSB7XG4gIC8vIENvbW1vbkpTXG4gIG1vZHVsZS5leHBvcnRzID0gZXZlbnRpZTtcbn0gZWxzZSB7XG4gIC8vIGJyb3dzZXIgZ2xvYmFsXG4gIHdpbmRvdy5ldmVudGllID0gZXZlbnRpZTtcbn1cblxufSkoIHdpbmRvdyApO1xuIiwiLyoqXG4gKiBDaGVjayBpZiBhcmd1bWVudCBpcyBhIEhUTUwgZWxlbWVudC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdmFsdWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbmV4cG9ydHMubm9kZSA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlICE9PSB1bmRlZmluZWRcbiAgICAgICAgJiYgdmFsdWUgaW5zdGFuY2VvZiBIVE1MRWxlbWVudFxuICAgICAgICAmJiB2YWx1ZS5ub2RlVHlwZSA9PT0gMTtcbn07XG5cbi8qKlxuICogQ2hlY2sgaWYgYXJndW1lbnQgaXMgYSBsaXN0IG9mIEhUTUwgZWxlbWVudHMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHZhbHVlXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5leHBvcnRzLm5vZGVMaXN0ID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICB2YXIgdHlwZSA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSk7XG5cbiAgICByZXR1cm4gdmFsdWUgIT09IHVuZGVmaW5lZFxuICAgICAgICAmJiAodHlwZSA9PT0gJ1tvYmplY3QgTm9kZUxpc3RdJyB8fCB0eXBlID09PSAnW29iamVjdCBIVE1MQ29sbGVjdGlvbl0nKVxuICAgICAgICAmJiAoJ2xlbmd0aCcgaW4gdmFsdWUpXG4gICAgICAgICYmICh2YWx1ZS5sZW5ndGggPT09IDAgfHwgZXhwb3J0cy5ub2RlKHZhbHVlWzBdKSk7XG59O1xuXG4vKipcbiAqIENoZWNrIGlmIGFyZ3VtZW50IGlzIGEgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuZXhwb3J0cy5zdHJpbmcgPSBmdW5jdGlvbih2YWx1ZSkge1xuICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnXG4gICAgICAgIHx8IHZhbHVlIGluc3RhbmNlb2YgU3RyaW5nO1xufTtcblxuLyoqXG4gKiBDaGVjayBpZiBhcmd1bWVudCBpcyBhIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB2YWx1ZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuZXhwb3J0cy5mbiA9IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdmFyIHR5cGUgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpO1xuXG4gICAgcmV0dXJuIHR5cGUgPT09ICdbb2JqZWN0IEZ1bmN0aW9uXSc7XG59O1xuIiwidmFyIGlzID0gcmVxdWlyZSgnLi9pcycpO1xudmFyIGRlbGVnYXRlID0gcmVxdWlyZSgnZGVsZWdhdGUnKTtcblxuLyoqXG4gKiBWYWxpZGF0ZXMgYWxsIHBhcmFtcyBhbmQgY2FsbHMgdGhlIHJpZ2h0XG4gKiBsaXN0ZW5lciBmdW5jdGlvbiBiYXNlZCBvbiBpdHMgdGFyZ2V0IHR5cGUuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8SFRNTEVsZW1lbnR8SFRNTENvbGxlY3Rpb258Tm9kZUxpc3R9IHRhcmdldFxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cbmZ1bmN0aW9uIGxpc3Rlbih0YXJnZXQsIHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0YXJnZXQgJiYgIXR5cGUgJiYgIWNhbGxiYWNrKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignTWlzc2luZyByZXF1aXJlZCBhcmd1bWVudHMnKTtcbiAgICB9XG5cbiAgICBpZiAoIWlzLnN0cmluZyh0eXBlKSkge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdTZWNvbmQgYXJndW1lbnQgbXVzdCBiZSBhIFN0cmluZycpO1xuICAgIH1cblxuICAgIGlmICghaXMuZm4oY2FsbGJhY2spKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ1RoaXJkIGFyZ3VtZW50IG11c3QgYmUgYSBGdW5jdGlvbicpO1xuICAgIH1cblxuICAgIGlmIChpcy5ub2RlKHRhcmdldCkpIHtcbiAgICAgICAgcmV0dXJuIGxpc3Rlbk5vZGUodGFyZ2V0LCB0eXBlLCBjYWxsYmFjayk7XG4gICAgfVxuICAgIGVsc2UgaWYgKGlzLm5vZGVMaXN0KHRhcmdldCkpIHtcbiAgICAgICAgcmV0dXJuIGxpc3Rlbk5vZGVMaXN0KHRhcmdldCwgdHlwZSwgY2FsbGJhY2spO1xuICAgIH1cbiAgICBlbHNlIGlmIChpcy5zdHJpbmcodGFyZ2V0KSkge1xuICAgICAgICByZXR1cm4gbGlzdGVuU2VsZWN0b3IodGFyZ2V0LCB0eXBlLCBjYWxsYmFjayk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdGaXJzdCBhcmd1bWVudCBtdXN0IGJlIGEgU3RyaW5nLCBIVE1MRWxlbWVudCwgSFRNTENvbGxlY3Rpb24sIG9yIE5vZGVMaXN0Jyk7XG4gICAgfVxufVxuXG4vKipcbiAqIEFkZHMgYW4gZXZlbnQgbGlzdGVuZXIgdG8gYSBIVE1MIGVsZW1lbnRcbiAqIGFuZCByZXR1cm5zIGEgcmVtb3ZlIGxpc3RlbmVyIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG5vZGVcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5mdW5jdGlvbiBsaXN0ZW5Ob2RlKG5vZGUsIHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgbm9kZS5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrKTtcblxuICAgIHJldHVybiB7XG4gICAgICAgIGRlc3Ryb3k6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuLyoqXG4gKiBBZGQgYW4gZXZlbnQgbGlzdGVuZXIgdG8gYSBsaXN0IG9mIEhUTUwgZWxlbWVudHNcbiAqIGFuZCByZXR1cm5zIGEgcmVtb3ZlIGxpc3RlbmVyIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7Tm9kZUxpc3R8SFRNTENvbGxlY3Rpb259IG5vZGVMaXN0XG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuZnVuY3Rpb24gbGlzdGVuTm9kZUxpc3Qobm9kZUxpc3QsIHR5cGUsIGNhbGxiYWNrKSB7XG4gICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChub2RlTGlzdCwgZnVuY3Rpb24obm9kZSkge1xuICAgICAgICBub2RlLmFkZEV2ZW50TGlzdGVuZXIodHlwZSwgY2FsbGJhY2spO1xuICAgIH0pO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgZGVzdHJveTogZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKG5vZGVMaXN0LCBmdW5jdGlvbihub2RlKSB7XG4gICAgICAgICAgICAgICAgbm9kZS5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGNhbGxiYWNrKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxufVxuXG4vKipcbiAqIEFkZCBhbiBldmVudCBsaXN0ZW5lciB0byBhIHNlbGVjdG9yXG4gKiBhbmQgcmV0dXJucyBhIHJlbW92ZSBsaXN0ZW5lciBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc2VsZWN0b3JcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5mdW5jdGlvbiBsaXN0ZW5TZWxlY3RvcihzZWxlY3RvciwgdHlwZSwgY2FsbGJhY2spIHtcbiAgICByZXR1cm4gZGVsZWdhdGUoZG9jdW1lbnQuYm9keSwgc2VsZWN0b3IsIHR5cGUsIGNhbGxiYWNrKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBsaXN0ZW47XG4iLCJleHBvcnRzLnJlYWQgPSBmdW5jdGlvbiAoYnVmZmVyLCBvZmZzZXQsIGlzTEUsIG1MZW4sIG5CeXRlcykge1xuICB2YXIgZSwgbVxuICB2YXIgZUxlbiA9IG5CeXRlcyAqIDggLSBtTGVuIC0gMVxuICB2YXIgZU1heCA9ICgxIDw8IGVMZW4pIC0gMVxuICB2YXIgZUJpYXMgPSBlTWF4ID4+IDFcbiAgdmFyIG5CaXRzID0gLTdcbiAgdmFyIGkgPSBpc0xFID8gKG5CeXRlcyAtIDEpIDogMFxuICB2YXIgZCA9IGlzTEUgPyAtMSA6IDFcbiAgdmFyIHMgPSBidWZmZXJbb2Zmc2V0ICsgaV1cblxuICBpICs9IGRcblxuICBlID0gcyAmICgoMSA8PCAoLW5CaXRzKSkgLSAxKVxuICBzID4+PSAoLW5CaXRzKVxuICBuQml0cyArPSBlTGVuXG4gIGZvciAoOyBuQml0cyA+IDA7IGUgPSBlICogMjU2ICsgYnVmZmVyW29mZnNldCArIGldLCBpICs9IGQsIG5CaXRzIC09IDgpIHt9XG5cbiAgbSA9IGUgJiAoKDEgPDwgKC1uQml0cykpIC0gMSlcbiAgZSA+Pj0gKC1uQml0cylcbiAgbkJpdHMgKz0gbUxlblxuICBmb3IgKDsgbkJpdHMgPiAwOyBtID0gbSAqIDI1NiArIGJ1ZmZlcltvZmZzZXQgKyBpXSwgaSArPSBkLCBuQml0cyAtPSA4KSB7fVxuXG4gIGlmIChlID09PSAwKSB7XG4gICAgZSA9IDEgLSBlQmlhc1xuICB9IGVsc2UgaWYgKGUgPT09IGVNYXgpIHtcbiAgICByZXR1cm4gbSA/IE5hTiA6ICgocyA/IC0xIDogMSkgKiBJbmZpbml0eSlcbiAgfSBlbHNlIHtcbiAgICBtID0gbSArIE1hdGgucG93KDIsIG1MZW4pXG4gICAgZSA9IGUgLSBlQmlhc1xuICB9XG4gIHJldHVybiAocyA/IC0xIDogMSkgKiBtICogTWF0aC5wb3coMiwgZSAtIG1MZW4pXG59XG5cbmV4cG9ydHMud3JpdGUgPSBmdW5jdGlvbiAoYnVmZmVyLCB2YWx1ZSwgb2Zmc2V0LCBpc0xFLCBtTGVuLCBuQnl0ZXMpIHtcbiAgdmFyIGUsIG0sIGNcbiAgdmFyIGVMZW4gPSBuQnl0ZXMgKiA4IC0gbUxlbiAtIDFcbiAgdmFyIGVNYXggPSAoMSA8PCBlTGVuKSAtIDFcbiAgdmFyIGVCaWFzID0gZU1heCA+PiAxXG4gIHZhciBydCA9IChtTGVuID09PSAyMyA/IE1hdGgucG93KDIsIC0yNCkgLSBNYXRoLnBvdygyLCAtNzcpIDogMClcbiAgdmFyIGkgPSBpc0xFID8gMCA6IChuQnl0ZXMgLSAxKVxuICB2YXIgZCA9IGlzTEUgPyAxIDogLTFcbiAgdmFyIHMgPSB2YWx1ZSA8IDAgfHwgKHZhbHVlID09PSAwICYmIDEgLyB2YWx1ZSA8IDApID8gMSA6IDBcblxuICB2YWx1ZSA9IE1hdGguYWJzKHZhbHVlKVxuXG4gIGlmIChpc05hTih2YWx1ZSkgfHwgdmFsdWUgPT09IEluZmluaXR5KSB7XG4gICAgbSA9IGlzTmFOKHZhbHVlKSA/IDEgOiAwXG4gICAgZSA9IGVNYXhcbiAgfSBlbHNlIHtcbiAgICBlID0gTWF0aC5mbG9vcihNYXRoLmxvZyh2YWx1ZSkgLyBNYXRoLkxOMilcbiAgICBpZiAodmFsdWUgKiAoYyA9IE1hdGgucG93KDIsIC1lKSkgPCAxKSB7XG4gICAgICBlLS1cbiAgICAgIGMgKj0gMlxuICAgIH1cbiAgICBpZiAoZSArIGVCaWFzID49IDEpIHtcbiAgICAgIHZhbHVlICs9IHJ0IC8gY1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSArPSBydCAqIE1hdGgucG93KDIsIDEgLSBlQmlhcylcbiAgICB9XG4gICAgaWYgKHZhbHVlICogYyA+PSAyKSB7XG4gICAgICBlKytcbiAgICAgIGMgLz0gMlxuICAgIH1cblxuICAgIGlmIChlICsgZUJpYXMgPj0gZU1heCkge1xuICAgICAgbSA9IDBcbiAgICAgIGUgPSBlTWF4XG4gICAgfSBlbHNlIGlmIChlICsgZUJpYXMgPj0gMSkge1xuICAgICAgbSA9ICh2YWx1ZSAqIGMgLSAxKSAqIE1hdGgucG93KDIsIG1MZW4pXG4gICAgICBlID0gZSArIGVCaWFzXG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSB2YWx1ZSAqIE1hdGgucG93KDIsIGVCaWFzIC0gMSkgKiBNYXRoLnBvdygyLCBtTGVuKVxuICAgICAgZSA9IDBcbiAgICB9XG4gIH1cblxuICBmb3IgKDsgbUxlbiA+PSA4OyBidWZmZXJbb2Zmc2V0ICsgaV0gPSBtICYgMHhmZiwgaSArPSBkLCBtIC89IDI1NiwgbUxlbiAtPSA4KSB7fVxuXG4gIGUgPSAoZSA8PCBtTGVuKSB8IG1cbiAgZUxlbiArPSBtTGVuXG4gIGZvciAoOyBlTGVuID4gMDsgYnVmZmVyW29mZnNldCArIGldID0gZSAmIDB4ZmYsIGkgKz0gZCwgZSAvPSAyNTYsIGVMZW4gLT0gOCkge31cblxuICBidWZmZXJbb2Zmc2V0ICsgaSAtIGRdIHw9IHMgKiAxMjhcbn1cbiIsIlxyXG4vKipcclxuICogRWxlbWVudCBwcm90b3R5cGUuXHJcbiAqL1xyXG5cclxudmFyIHByb3RvID0gRWxlbWVudC5wcm90b3R5cGU7XHJcblxyXG4vKipcclxuICogVmVuZG9yIGZ1bmN0aW9uLlxyXG4gKi9cclxuXHJcbnZhciB2ZW5kb3IgPSBwcm90by5tYXRjaGVzU2VsZWN0b3JcclxuICB8fCBwcm90by53ZWJraXRNYXRjaGVzU2VsZWN0b3JcclxuICB8fCBwcm90by5tb3pNYXRjaGVzU2VsZWN0b3JcclxuICB8fCBwcm90by5tc01hdGNoZXNTZWxlY3RvclxyXG4gIHx8IHByb3RvLm9NYXRjaGVzU2VsZWN0b3I7XHJcblxyXG4vKipcclxuICogRXhwb3NlIGBtYXRjaCgpYC5cclxuICovXHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IG1hdGNoO1xyXG5cclxuLyoqXHJcbiAqIE1hdGNoIGBlbGAgdG8gYHNlbGVjdG9yYC5cclxuICpcclxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxyXG4gKiBAcGFyYW0ge1N0cmluZ30gc2VsZWN0b3JcclxuICogQHJldHVybiB7Qm9vbGVhbn1cclxuICogQGFwaSBwdWJsaWNcclxuICovXHJcblxyXG5mdW5jdGlvbiBtYXRjaChlbCwgc2VsZWN0b3IpIHtcclxuICBpZiAodmVuZG9yKSByZXR1cm4gdmVuZG9yLmNhbGwoZWwsIHNlbGVjdG9yKTtcclxuICB2YXIgbm9kZXMgPSBlbC5wYXJlbnROb2RlLnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3IpO1xyXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyArK2kpIHtcclxuICAgIGlmIChub2Rlc1tpXSA9PSBlbCkgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG4gIHJldHVybiBmYWxzZTtcclxufSIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG52YXIgcXVldWUgPSBbXTtcbnZhciBkcmFpbmluZyA9IGZhbHNlO1xudmFyIGN1cnJlbnRRdWV1ZTtcbnZhciBxdWV1ZUluZGV4ID0gLTE7XG5cbmZ1bmN0aW9uIGNsZWFuVXBOZXh0VGljaygpIHtcbiAgICBkcmFpbmluZyA9IGZhbHNlO1xuICAgIGlmIChjdXJyZW50UXVldWUubGVuZ3RoKSB7XG4gICAgICAgIHF1ZXVlID0gY3VycmVudFF1ZXVlLmNvbmNhdChxdWV1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgIH1cbiAgICBpZiAocXVldWUubGVuZ3RoKSB7XG4gICAgICAgIGRyYWluUXVldWUoKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGRyYWluUXVldWUoKSB7XG4gICAgaWYgKGRyYWluaW5nKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGNsZWFuVXBOZXh0VGljayk7XG4gICAgZHJhaW5pbmcgPSB0cnVlO1xuXG4gICAgdmFyIGxlbiA9IHF1ZXVlLmxlbmd0aDtcbiAgICB3aGlsZShsZW4pIHtcbiAgICAgICAgY3VycmVudFF1ZXVlID0gcXVldWU7XG4gICAgICAgIHF1ZXVlID0gW107XG4gICAgICAgIHdoaWxlICgrK3F1ZXVlSW5kZXggPCBsZW4pIHtcbiAgICAgICAgICAgIGlmIChjdXJyZW50UXVldWUpIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50UXVldWVbcXVldWVJbmRleF0ucnVuKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcXVldWVJbmRleCA9IC0xO1xuICAgICAgICBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgfVxuICAgIGN1cnJlbnRRdWV1ZSA9IG51bGw7XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBjbGVhclRpbWVvdXQodGltZW91dCk7XG59XG5cbnByb2Nlc3MubmV4dFRpY2sgPSBmdW5jdGlvbiAoZnVuKSB7XG4gICAgdmFyIGFyZ3MgPSBuZXcgQXJyYXkoYXJndW1lbnRzLmxlbmd0aCAtIDEpO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMSkge1xuICAgICAgICBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIH1cbiAgICB9XG4gICAgcXVldWUucHVzaChuZXcgSXRlbShmdW4sIGFyZ3MpKTtcbiAgICBpZiAocXVldWUubGVuZ3RoID09PSAxICYmICFkcmFpbmluZykge1xuICAgICAgICBzZXRUaW1lb3V0KGRyYWluUXVldWUsIDApO1xuICAgIH1cbn07XG5cbi8vIHY4IGxpa2VzIHByZWRpY3RpYmxlIG9iamVjdHNcbmZ1bmN0aW9uIEl0ZW0oZnVuLCBhcnJheSkge1xuICAgIHRoaXMuZnVuID0gZnVuO1xuICAgIHRoaXMuYXJyYXkgPSBhcnJheTtcbn1cbkl0ZW0ucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmZ1bi5hcHBseShudWxsLCB0aGlzLmFycmF5KTtcbn07XG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcbnByb2Nlc3MudmVyc2lvbiA9ICcnOyAvLyBlbXB0eSBzdHJpbmcgdG8gYXZvaWQgcmVnZXhwIGlzc3Vlc1xucHJvY2Vzcy52ZXJzaW9ucyA9IHt9O1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufTtcblxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5wcm9jZXNzLnVtYXNrID0gZnVuY3Rpb24oKSB7IHJldHVybiAwOyB9O1xuIiwiZnVuY3Rpb24gc2VsZWN0KGVsZW1lbnQpIHtcbiAgICB2YXIgc2VsZWN0ZWRUZXh0O1xuXG4gICAgaWYgKGVsZW1lbnQubm9kZU5hbWUgPT09ICdJTlBVVCcgfHwgZWxlbWVudC5ub2RlTmFtZSA9PT0gJ1RFWFRBUkVBJykge1xuICAgICAgICBlbGVtZW50LmZvY3VzKCk7XG4gICAgICAgIGVsZW1lbnQuc2V0U2VsZWN0aW9uUmFuZ2UoMCwgZWxlbWVudC52YWx1ZS5sZW5ndGgpO1xuXG4gICAgICAgIHNlbGVjdGVkVGV4dCA9IGVsZW1lbnQudmFsdWU7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgICBpZiAoZWxlbWVudC5oYXNBdHRyaWJ1dGUoJ2NvbnRlbnRlZGl0YWJsZScpKSB7XG4gICAgICAgICAgICBlbGVtZW50LmZvY3VzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgc2VsZWN0aW9uID0gd2luZG93LmdldFNlbGVjdGlvbigpO1xuICAgICAgICB2YXIgcmFuZ2UgPSBkb2N1bWVudC5jcmVhdGVSYW5nZSgpO1xuXG4gICAgICAgIHJhbmdlLnNlbGVjdE5vZGVDb250ZW50cyhlbGVtZW50KTtcbiAgICAgICAgc2VsZWN0aW9uLnJlbW92ZUFsbFJhbmdlcygpO1xuICAgICAgICBzZWxlY3Rpb24uYWRkUmFuZ2UocmFuZ2UpO1xuXG4gICAgICAgIHNlbGVjdGVkVGV4dCA9IHNlbGVjdGlvbi50b1N0cmluZygpO1xuICAgIH1cblxuICAgIHJldHVybiBzZWxlY3RlZFRleHQ7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2VsZWN0O1xuIiwiZnVuY3Rpb24gRSAoKSB7XG5cdC8vIEtlZXAgdGhpcyBlbXB0eSBzbyBpdCdzIGVhc2llciB0byBpbmhlcml0IGZyb21cbiAgLy8gKHZpYSBodHRwczovL2dpdGh1Yi5jb20vbGlwc21hY2sgZnJvbSBodHRwczovL2dpdGh1Yi5jb20vc2NvdHRjb3JnYW4vdGlueS1lbWl0dGVyL2lzc3Vlcy8zKVxufVxuXG5FLnByb3RvdHlwZSA9IHtcblx0b246IGZ1bmN0aW9uIChuYW1lLCBjYWxsYmFjaywgY3R4KSB7XG4gICAgdmFyIGUgPSB0aGlzLmUgfHwgKHRoaXMuZSA9IHt9KTtcblxuICAgIChlW25hbWVdIHx8IChlW25hbWVdID0gW10pKS5wdXNoKHtcbiAgICAgIGZuOiBjYWxsYmFjayxcbiAgICAgIGN0eDogY3R4XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICBvbmNlOiBmdW5jdGlvbiAobmFtZSwgY2FsbGJhY2ssIGN0eCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBmdW5jdGlvbiBsaXN0ZW5lciAoKSB7XG4gICAgICBzZWxmLm9mZihuYW1lLCBsaXN0ZW5lcik7XG4gICAgICBjYWxsYmFjay5hcHBseShjdHgsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIGxpc3RlbmVyLl8gPSBjYWxsYmFja1xuICAgIHJldHVybiB0aGlzLm9uKG5hbWUsIGxpc3RlbmVyLCBjdHgpO1xuICB9LFxuXG4gIGVtaXQ6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdmFyIGRhdGEgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgdmFyIGV2dEFyciA9ICgodGhpcy5lIHx8ICh0aGlzLmUgPSB7fSkpW25hbWVdIHx8IFtdKS5zbGljZSgpO1xuICAgIHZhciBpID0gMDtcbiAgICB2YXIgbGVuID0gZXZ0QXJyLmxlbmd0aDtcblxuICAgIGZvciAoaTsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBldnRBcnJbaV0uZm4uYXBwbHkoZXZ0QXJyW2ldLmN0eCwgZGF0YSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG5cbiAgb2ZmOiBmdW5jdGlvbiAobmFtZSwgY2FsbGJhY2spIHtcbiAgICB2YXIgZSA9IHRoaXMuZSB8fCAodGhpcy5lID0ge30pO1xuICAgIHZhciBldnRzID0gZVtuYW1lXTtcbiAgICB2YXIgbGl2ZUV2ZW50cyA9IFtdO1xuXG4gICAgaWYgKGV2dHMgJiYgY2FsbGJhY2spIHtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBldnRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGlmIChldnRzW2ldLmZuICE9PSBjYWxsYmFjayAmJiBldnRzW2ldLmZuLl8gIT09IGNhbGxiYWNrKVxuICAgICAgICAgIGxpdmVFdmVudHMucHVzaChldnRzW2ldKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBSZW1vdmUgZXZlbnQgZnJvbSBxdWV1ZSB0byBwcmV2ZW50IG1lbW9yeSBsZWFrXG4gICAgLy8gU3VnZ2VzdGVkIGJ5IGh0dHBzOi8vZ2l0aHViLmNvbS9sYXpkXG4gICAgLy8gUmVmOiBodHRwczovL2dpdGh1Yi5jb20vc2NvdHRjb3JnYW4vdGlueS1lbWl0dGVyL2NvbW1pdC9jNmViZmFhOWJjOTczYjMzZDExMGE4NGEzMDc3NDJiN2NmOTRjOTUzI2NvbW1pdGNvbW1lbnQtNTAyNDkxMFxuXG4gICAgKGxpdmVFdmVudHMubGVuZ3RoKVxuICAgICAgPyBlW25hbWVdID0gbGl2ZUV2ZW50c1xuICAgICAgOiBkZWxldGUgZVtuYW1lXTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEU7XG4iLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5cbnZhciBfY3JlYXRlQ29tcG9uZW50ID0gcmVxdWlyZSgnLi9jcmVhdGVDb21wb25lbnQnKTtcblxudmFyIF9jcmVhdGVDb21wb25lbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY3JlYXRlQ29tcG9uZW50KTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuZXhwb3J0cy5kZWZhdWx0ID0gKDAsIF9jcmVhdGVDb21wb25lbnQyLmRlZmF1bHQpKCk7IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xudmFyIHVhID0gZ2xvYmFsLm5hdmlnYXRvciA/IGdsb2JhbC5uYXZpZ2F0b3IudXNlckFnZW50IDogJyc7XG5cbnZhciBpc1RyaWRlbnQgPSBleHBvcnRzLmlzVHJpZGVudCA9IHVhLmluZGV4T2YoJ1RyaWRlbnQnKSA+IC0xO1xudmFyIGlzRWRnZSA9IGV4cG9ydHMuaXNFZGdlID0gdWEuaW5kZXhPZignRWRnZScpID4gLTE7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3R5cGVvZiA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgU3ltYm9sLml0ZXJhdG9yID09PSBcInN5bWJvbFwiID8gZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gdHlwZW9mIG9iajsgfSA6IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIG9iaiAmJiB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb2JqLmNvbnN0cnVjdG9yID09PSBTeW1ib2wgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajsgfTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuXG5leHBvcnRzLmRlZmF1bHQgPSBmdW5jdGlvbiAoYXR0ck5hbWUpIHtcbiAgICByZXR1cm4gYXR0cnNDZmdbYXR0ck5hbWVdIHx8IERFRkFVTFRfQVRUUl9DRkc7XG59O1xuXG52YXIgX2VzY2FwZUF0dHIgPSByZXF1aXJlKCcuLi91dGlscy9lc2NhcGVBdHRyJyk7XG5cbnZhciBfZXNjYXBlQXR0cjIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9lc2NhcGVBdHRyKTtcblxudmFyIF9pc0luQXJyYXkgPSByZXF1aXJlKCcuLi91dGlscy9pc0luQXJyYXknKTtcblxudmFyIF9pc0luQXJyYXkyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfaXNJbkFycmF5KTtcblxudmFyIF9kYXNoZXJpemUgPSByZXF1aXJlKCcuLi91dGlscy9kYXNoZXJpemUnKTtcblxudmFyIF9kYXNoZXJpemUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZGFzaGVyaXplKTtcblxudmFyIF9jb25zb2xlID0gcmVxdWlyZSgnLi4vdXRpbHMvY29uc29sZScpO1xuXG52YXIgX2NvbnNvbGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY29uc29sZSk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG5cbmZ1bmN0aW9uIHNldEF0dHIobm9kZSwgbmFtZSwgdmFsKSB7XG4gICAgaWYgKG5hbWUgPT09ICd0eXBlJyAmJiBub2RlLnRhZ05hbWUgPT09ICdJTlBVVCcpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gbm9kZS52YWx1ZTsgLy8gdmFsdWUgd2lsbCBiZSBsb3N0IGluIElFIGlmIHR5cGUgaXMgY2hhbmdlZFxuICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShuYW1lLCAnJyArIHZhbCk7XG4gICAgICAgIG5vZGUudmFsdWUgPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShBVFRSX05BTUVTW25hbWVdIHx8IG5hbWUsICcnICsgdmFsKTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHNldEJvb2xlYW5BdHRyKG5vZGUsIG5hbWUsIHZhbCkge1xuICAgIGlmICh2YWwpIHtcbiAgICAgICAgc2V0QXR0cihub2RlLCBuYW1lLCB2YWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHJlbW92ZUF0dHIobm9kZSwgbmFtZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzZXRQcm9wKG5vZGUsIG5hbWUsIHZhbCkge1xuICAgIG5vZGVbbmFtZV0gPSB2YWw7XG59XG5cbmZ1bmN0aW9uIHNldE9ialByb3Aobm9kZSwgbmFtZSwgdmFsKSB7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgdmFyIHR5cGVPZlZhbCA9IHR5cGVvZiB2YWwgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKHZhbCk7XG4gICAgICAgIGlmICh0eXBlT2ZWYWwgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICBfY29uc29sZTIuZGVmYXVsdC5lcnJvcignXCInICsgbmFtZSArICdcIiBhdHRyaWJ1dGUgZXhwZWN0cyBhbiBvYmplY3QgYXMgYSB2YWx1ZSwgbm90IGEgJyArIHR5cGVPZlZhbCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgcHJvcCA9IG5vZGVbbmFtZV07XG4gICAgZm9yICh2YXIgaSBpbiB2YWwpIHtcbiAgICAgICAgcHJvcFtpXSA9IHZhbFtpXSA9PSBudWxsID8gJycgOiB2YWxbaV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzZXRQcm9wV2l0aENoZWNrKG5vZGUsIG5hbWUsIHZhbCkge1xuICAgIGlmIChuYW1lID09PSAndmFsdWUnICYmIG5vZGUudGFnTmFtZSA9PT0gJ1NFTEVDVCcpIHtcbiAgICAgICAgc2V0U2VsZWN0VmFsdWUobm9kZSwgdmFsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBub2RlW25hbWVdICE9PSB2YWwgJiYgKG5vZGVbbmFtZV0gPSB2YWwpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlQXR0cihub2RlLCBuYW1lKSB7XG4gICAgbm9kZS5yZW1vdmVBdHRyaWJ1dGUoQVRUUl9OQU1FU1tuYW1lXSB8fCBuYW1lKTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlUHJvcChub2RlLCBuYW1lKSB7XG4gICAgaWYgKG5hbWUgPT09ICdzdHlsZScpIHtcbiAgICAgICAgbm9kZVtuYW1lXS5jc3NUZXh0ID0gJyc7XG4gICAgfSBlbHNlIGlmIChuYW1lID09PSAndmFsdWUnICYmIG5vZGUudGFnTmFtZSA9PT0gJ1NFTEVDVCcpIHtcbiAgICAgICAgcmVtb3ZlU2VsZWN0VmFsdWUobm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbm9kZVtuYW1lXSA9IGdldERlZmF1bHRQcm9wVmFsKG5vZGUudGFnTmFtZSwgbmFtZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzZXRTZWxlY3RWYWx1ZShub2RlLCB2YWx1ZSkge1xuICAgIHZhciBpc011bHRpcGxlID0gQXJyYXkuaXNBcnJheSh2YWx1ZSksXG4gICAgICAgIG9wdGlvbnMgPSBub2RlLm9wdGlvbnMsXG4gICAgICAgIGxlbiA9IG9wdGlvbnMubGVuZ3RoO1xuXG4gICAgdmFyIGkgPSAwLFxuICAgICAgICBvcHRpb25Ob2RlID0gdW5kZWZpbmVkO1xuXG4gICAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICAgICAgb3B0aW9uTm9kZSA9IG9wdGlvbnNbaSsrXTtcbiAgICAgICAgb3B0aW9uTm9kZS5zZWxlY3RlZCA9IHZhbHVlICE9IG51bGwgJiYgKGlzTXVsdGlwbGUgPyAoMCwgX2lzSW5BcnJheTIuZGVmYXVsdCkodmFsdWUsIG9wdGlvbk5vZGUudmFsdWUpIDogb3B0aW9uTm9kZS52YWx1ZSA9PSB2YWx1ZSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmVTZWxlY3RWYWx1ZShub2RlKSB7XG4gICAgdmFyIG9wdGlvbnMgPSBub2RlLm9wdGlvbnMsXG4gICAgICAgIGxlbiA9IG9wdGlvbnMubGVuZ3RoO1xuXG4gICAgdmFyIGkgPSAwO1xuXG4gICAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICAgICAgb3B0aW9uc1tpKytdLnNlbGVjdGVkID0gZmFsc2U7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBhdHRyVG9TdHJpbmcobmFtZSwgdmFsdWUpIHtcbiAgICByZXR1cm4gKEFUVFJfTkFNRVNbbmFtZV0gfHwgbmFtZSkgKyAnPVwiJyArICgwLCBfZXNjYXBlQXR0cjIuZGVmYXVsdCkodmFsdWUpICsgJ1wiJztcbn1cblxuZnVuY3Rpb24gYm9vbGVhbkF0dHJUb1N0cmluZyhuYW1lLCB2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZSA/IG5hbWUgOiAnJztcbn1cblxuZnVuY3Rpb24gc3R5bGVQcm9wVG9TdHJpbmcobmFtZSwgdmFsdWUpIHtcbiAgICB2YXIgc3R5bGVzID0gJyc7XG5cbiAgICBmb3IgKHZhciBpIGluIHZhbHVlKSB7XG4gICAgICAgIHZhbHVlW2ldICE9IG51bGwgJiYgKHN0eWxlcyArPSAoMCwgX2Rhc2hlcml6ZTIuZGVmYXVsdCkoaSkgKyAnOicgKyB2YWx1ZVtpXSArICc7Jyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0eWxlcyA/IG5hbWUgKyAnPVwiJyArIHN0eWxlcyArICdcIicgOiBzdHlsZXM7XG59XG5cbnZhciBkZWZhdWx0UHJvcFZhbHMgPSB7fTtcbmZ1bmN0aW9uIGdldERlZmF1bHRQcm9wVmFsKHRhZywgYXR0ck5hbWUpIHtcbiAgICB2YXIgdGFnQXR0cnMgPSBkZWZhdWx0UHJvcFZhbHNbdGFnXSB8fCAoZGVmYXVsdFByb3BWYWxzW3RhZ10gPSB7fSk7XG4gICAgcmV0dXJuIGF0dHJOYW1lIGluIHRhZ0F0dHJzID8gdGFnQXR0cnNbYXR0ck5hbWVdIDogdGFnQXR0cnNbYXR0ck5hbWVdID0gZG9jLmNyZWF0ZUVsZW1lbnQodGFnKVthdHRyTmFtZV07XG59XG5cbnZhciBBVFRSX05BTUVTID0ge1xuICAgIGFjY2VwdENoYXJzZXQ6ICdhY2NlcHQtY2hhcnNldCcsXG4gICAgY2xhc3NOYW1lOiAnY2xhc3MnLFxuICAgIGh0bWxGb3I6ICdmb3InLFxuICAgIGh0dHBFcXVpdjogJ2h0dHAtZXF1aXYnLFxuICAgIGF1dG9DYXBpdGFsaXplOiAnYXV0b2NhcGl0YWxpemUnLFxuICAgIGF1dG9Db21wbGV0ZTogJ2F1dG9jb21wbGV0ZScsXG4gICAgYXV0b0NvcnJlY3Q6ICdhdXRvY29ycmVjdCcsXG4gICAgYXV0b0ZvY3VzOiAnYXV0b2ZvY3VzJyxcbiAgICBhdXRvUGxheTogJ2F1dG9wbGF5JyxcbiAgICBlbmNUeXBlOiAnZW5jb2RpbmcnLFxuICAgIGhyZWZMYW5nOiAnaHJlZmxhbmcnLFxuICAgIHJhZGlvR3JvdXA6ICdyYWRpb2dyb3VwJyxcbiAgICBzcGVsbENoZWNrOiAnc3BlbGxjaGVjaycsXG4gICAgc3JjRG9jOiAnc3JjZG9jJyxcbiAgICBzcmNTZXQ6ICdzcmNzZXQnLFxuICAgIHRhYkluZGV4OiAndGFiaW5kZXgnXG59LFxuICAgIERFRkFVTFRfQVRUUl9DRkcgPSB7XG4gICAgc2V0OiBzZXRBdHRyLFxuICAgIHJlbW92ZTogcmVtb3ZlQXR0cixcbiAgICB0b1N0cmluZzogYXR0clRvU3RyaW5nXG59LFxuICAgIEJPT0xFQU5fQVRUUl9DRkcgPSB7XG4gICAgc2V0OiBzZXRCb29sZWFuQXR0cixcbiAgICByZW1vdmU6IHJlbW92ZUF0dHIsXG4gICAgdG9TdHJpbmc6IGJvb2xlYW5BdHRyVG9TdHJpbmdcbn0sXG4gICAgREVGQVVMVF9QUk9QX0NGRyA9IHtcbiAgICBzZXQ6IHNldFByb3AsXG4gICAgcmVtb3ZlOiByZW1vdmVQcm9wLFxuICAgIHRvU3RyaW5nOiBhdHRyVG9TdHJpbmdcbn0sXG4gICAgQk9PTEVBTl9QUk9QX0NGRyA9IHtcbiAgICBzZXQ6IHNldFByb3AsXG4gICAgcmVtb3ZlOiByZW1vdmVQcm9wLFxuICAgIHRvU3RyaW5nOiBib29sZWFuQXR0clRvU3RyaW5nXG59LFxuICAgIGF0dHJzQ2ZnID0ge1xuICAgIGNoZWNrZWQ6IEJPT0xFQU5fUFJPUF9DRkcsXG4gICAgY29udHJvbHM6IERFRkFVTFRfUFJPUF9DRkcsXG4gICAgZGlzYWJsZWQ6IEJPT0xFQU5fQVRUUl9DRkcsXG4gICAgaWQ6IERFRkFVTFRfUFJPUF9DRkcsXG4gICAgaXNtYXA6IEJPT0xFQU5fQVRUUl9DRkcsXG4gICAgbG9vcDogREVGQVVMVF9QUk9QX0NGRyxcbiAgICBtdWx0aXBsZTogQk9PTEVBTl9QUk9QX0NGRyxcbiAgICBtdXRlZDogREVGQVVMVF9QUk9QX0NGRyxcbiAgICBvcGVuOiBCT09MRUFOX0FUVFJfQ0ZHLFxuICAgIHJlYWRPbmx5OiBCT09MRUFOX1BST1BfQ0ZHLFxuICAgIHNlbGVjdGVkOiBCT09MRUFOX1BST1BfQ0ZHLFxuICAgIHNyY0RvYzogREVGQVVMVF9QUk9QX0NGRyxcbiAgICBzdHlsZToge1xuICAgICAgICBzZXQ6IHNldE9ialByb3AsXG4gICAgICAgIHJlbW92ZTogcmVtb3ZlUHJvcCxcbiAgICAgICAgdG9TdHJpbmc6IHN0eWxlUHJvcFRvU3RyaW5nXG4gICAgfSxcbiAgICB2YWx1ZToge1xuICAgICAgICBzZXQ6IHNldFByb3BXaXRoQ2hlY2ssXG4gICAgICAgIHJlbW92ZTogcmVtb3ZlUHJvcCxcbiAgICAgICAgdG9TdHJpbmc6IGF0dHJUb1N0cmluZ1xuICAgIH1cbn07IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuZGVmYXVsdCA9IFN5bnRoZXRpY0V2ZW50O1xuZnVuY3Rpb24gU3ludGhldGljRXZlbnQodHlwZSwgbmF0aXZlRXZlbnQpIHtcbiAgICB0aGlzLnR5cGUgPSB0eXBlO1xuICAgIHRoaXMudGFyZ2V0ID0gbmF0aXZlRXZlbnQudGFyZ2V0O1xuICAgIHRoaXMubmF0aXZlRXZlbnQgPSBuYXRpdmVFdmVudDtcblxuICAgIHRoaXMuX2lzUHJvcGFnYXRpb25TdG9wcGVkID0gZmFsc2U7XG4gICAgdGhpcy5faXNEZWZhdWx0UHJldmVudGVkID0gZmFsc2U7XG59XG5cblN5bnRoZXRpY0V2ZW50LnByb3RvdHlwZSA9IHtcbiAgICBzdG9wUHJvcGFnYXRpb246IGZ1bmN0aW9uIHN0b3BQcm9wYWdhdGlvbigpIHtcbiAgICAgICAgdGhpcy5faXNQcm9wYWdhdGlvblN0b3BwZWQgPSB0cnVlO1xuXG4gICAgICAgIHZhciBuYXRpdmVFdmVudCA9IHRoaXMubmF0aXZlRXZlbnQ7XG4gICAgICAgIG5hdGl2ZUV2ZW50LnN0b3BQcm9wYWdhdGlvbiA/IG5hdGl2ZUV2ZW50LnN0b3BQcm9wYWdhdGlvbigpIDogbmF0aXZlRXZlbnQuY2FuY2VsQnViYmxlID0gdHJ1ZTtcbiAgICB9LFxuICAgIGlzUHJvcGFnYXRpb25TdG9wcGVkOiBmdW5jdGlvbiBpc1Byb3BhZ2F0aW9uU3RvcHBlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lzUHJvcGFnYXRpb25TdG9wcGVkO1xuICAgIH0sXG4gICAgcHJldmVudERlZmF1bHQ6IGZ1bmN0aW9uIHByZXZlbnREZWZhdWx0KCkge1xuICAgICAgICB0aGlzLl9pc0RlZmF1bHRQcmV2ZW50ZWQgPSB0cnVlO1xuXG4gICAgICAgIHZhciBuYXRpdmVFdmVudCA9IHRoaXMubmF0aXZlRXZlbnQ7XG4gICAgICAgIG5hdGl2ZUV2ZW50LnByZXZlbnREZWZhdWx0ID8gbmF0aXZlRXZlbnQucHJldmVudERlZmF1bHQoKSA6IG5hdGl2ZUV2ZW50LnJldHVyblZhbHVlID0gZmFsc2U7XG4gICAgfSxcbiAgICBpc0RlZmF1bHRQcmV2ZW50ZWQ6IGZ1bmN0aW9uIGlzRGVmYXVsdFByZXZlbnRlZCgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2lzRGVmYXVsdFByZXZlbnRlZDtcbiAgICB9XG59OyIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0cy5kZWZhdWx0ID0ge1xuICAgIG9uTW91c2VPdmVyOiAnbW91c2VvdmVyJyxcbiAgICBvbk1vdXNlTW92ZTogJ21vdXNlbW92ZScsXG4gICAgb25Nb3VzZU91dDogJ21vdXNlb3V0JyxcbiAgICBvbk1vdXNlRG93bjogJ21vdXNlZG93bicsXG4gICAgb25Nb3VzZVVwOiAnbW91c2V1cCcsXG4gICAgb25DbGljazogJ2NsaWNrJyxcbiAgICBvbkRibENsaWNrOiAnZGJsY2xpY2snLFxuICAgIG9uS2V5RG93bjogJ2tleWRvd24nLFxuICAgIG9uS2V5UHJlc3M6ICdrZXlwcmVzcycsXG4gICAgb25LZXlVcDogJ2tleXVwJyxcbiAgICBvbkNoYW5nZTogJ2NoYW5nZScsXG4gICAgb25JbnB1dDogJ2lucHV0JyxcbiAgICBvblN1Ym1pdDogJ3N1Ym1pdCcsXG4gICAgb25Gb2N1czogJ2ZvY3VzJyxcbiAgICBvbkJsdXI6ICdibHVyJyxcbiAgICBvblNjcm9sbDogJ3Njcm9sbCcsXG4gICAgb25Mb2FkOiAnbG9hZCcsXG4gICAgb25FcnJvcjogJ2Vycm9yJyxcbiAgICBvbkNvbnRleHRNZW51OiAnY29udGV4dG1lbnUnLFxuICAgIG9uRHJhZ1N0YXJ0OiAnZHJhZ3N0YXJ0JyxcbiAgICBvbkRyYWc6ICdkcmFnJyxcbiAgICBvbkRyYWdFbnRlcjogJ2RyYWdlbnRlcicsXG4gICAgb25EcmFnT3ZlcjogJ2RyYWdvdmVyJyxcbiAgICBvbkRyYWdMZWF2ZTogJ2RyYWdsZWF2ZScsXG4gICAgb25EcmFnRW5kOiAnZHJhZ2VuZCcsXG4gICAgb25Ecm9wOiAnZHJvcCcsXG4gICAgb25XaGVlbDogJ3doZWVsJyxcbiAgICBvbkNvcHk6ICdjb3B5JyxcbiAgICBvbkN1dDogJ2N1dCcsXG4gICAgb25QYXN0ZTogJ3Bhc3RlJ1xufTsiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMucmVtb3ZlTGlzdGVuZXJzID0gZXhwb3J0cy5yZW1vdmVMaXN0ZW5lciA9IGV4cG9ydHMuYWRkTGlzdGVuZXIgPSB1bmRlZmluZWQ7XG5cbnZhciBfaXNFdmVudFN1cHBvcnRlZCA9IHJlcXVpcmUoJy4vaXNFdmVudFN1cHBvcnRlZCcpO1xuXG52YXIgX2lzRXZlbnRTdXBwb3J0ZWQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfaXNFdmVudFN1cHBvcnRlZCk7XG5cbnZhciBfU3ludGhldGljRXZlbnQgPSByZXF1aXJlKCcuL1N5bnRoZXRpY0V2ZW50Jyk7XG5cbnZhciBfU3ludGhldGljRXZlbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfU3ludGhldGljRXZlbnQpO1xuXG52YXIgX2dldERvbU5vZGVJZCA9IHJlcXVpcmUoJy4uL2dldERvbU5vZGVJZCcpO1xuXG52YXIgX2dldERvbU5vZGVJZDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9nZXREb21Ob2RlSWQpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50LFxuICAgIEJVQkJMRUFCTEVfTkFUSVZFX0VWRU5UUyA9IFsnbW91c2VvdmVyJywgJ21vdXNlbW92ZScsICdtb3VzZW91dCcsICdtb3VzZWRvd24nLCAnbW91c2V1cCcsICdjbGljaycsICdkYmxjbGljaycsICdrZXlkb3duJywgJ2tleXByZXNzJywgJ2tleXVwJywgJ2NoYW5nZScsICdpbnB1dCcsICdzdWJtaXQnLCAnZm9jdXMnLCAnYmx1cicsICdkcmFnc3RhcnQnLCAnZHJhZycsICdkcmFnZW50ZXInLCAnZHJhZ292ZXInLCAnZHJhZ2xlYXZlJywgJ2RyYWdlbmQnLCAnZHJvcCcsICdjb250ZXh0bWVudScsICd3aGVlbCcsICdjb3B5JywgJ2N1dCcsICdwYXN0ZSddLFxuICAgIE5PTl9CVUJCTEVBQkxFX05BVElWRV9FVkVOVFMgPSBbJ3Njcm9sbCcsICdsb2FkJywgJ2Vycm9yJ107XG5cbnZhciBsaXN0ZW5lcnNTdG9yYWdlID0ge30sXG4gICAgZXZlbnRzQ2ZnID0ge307XG5cbmZ1bmN0aW9uIGdsb2JhbEV2ZW50TGlzdGVuZXIoZSwgdHlwZSkge1xuICAgIHR5cGUgfHwgKHR5cGUgPSBlLnR5cGUpO1xuXG4gICAgdmFyIGNmZyA9IGV2ZW50c0NmZ1t0eXBlXSxcbiAgICAgICAgbGlzdGVuZXJzVG9JbnZva2UgPSBbXTtcblxuICAgIHZhciB0YXJnZXQgPSBlLnRhcmdldCxcbiAgICAgICAgbGlzdGVuZXJzQ291bnQgPSBjZmcubGlzdGVuZXJzQ291bnRlcixcbiAgICAgICAgbGlzdGVuZXJzID0gdW5kZWZpbmVkLFxuICAgICAgICBsaXN0ZW5lciA9IHVuZGVmaW5lZCxcbiAgICAgICAgZG9tTm9kZUlkID0gdW5kZWZpbmVkO1xuXG4gICAgd2hpbGUgKGxpc3RlbmVyc0NvdW50ID4gMCAmJiB0YXJnZXQgJiYgdGFyZ2V0ICE9PSBkb2MpIHtcbiAgICAgICAgaWYgKGRvbU5vZGVJZCA9ICgwLCBfZ2V0RG9tTm9kZUlkMi5kZWZhdWx0KSh0YXJnZXQsIHRydWUpKSB7XG4gICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNTdG9yYWdlW2RvbU5vZGVJZF07XG4gICAgICAgICAgICBpZiAobGlzdGVuZXJzICYmIChsaXN0ZW5lciA9IGxpc3RlbmVyc1t0eXBlXSkpIHtcbiAgICAgICAgICAgICAgICBsaXN0ZW5lcnNUb0ludm9rZS5wdXNoKGxpc3RlbmVyKTtcbiAgICAgICAgICAgICAgICAtLWxpc3RlbmVyc0NvdW50O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGFyZ2V0ID0gdGFyZ2V0LnBhcmVudE5vZGU7XG4gICAgfVxuXG4gICAgaWYgKGxpc3RlbmVyc1RvSW52b2tlLmxlbmd0aCkge1xuICAgICAgICB2YXIgZXZlbnQgPSBuZXcgX1N5bnRoZXRpY0V2ZW50Mi5kZWZhdWx0KHR5cGUsIGUpLFxuICAgICAgICAgICAgbGVuID0gbGlzdGVuZXJzVG9JbnZva2UubGVuZ3RoO1xuXG4gICAgICAgIHZhciBpID0gMDtcblxuICAgICAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgICAgICAgbGlzdGVuZXJzVG9JbnZva2VbaSsrXShldmVudCk7XG4gICAgICAgICAgICBpZiAoZXZlbnQuaXNQcm9wYWdhdGlvblN0b3BwZWQoKSkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBldmVudExpc3RlbmVyKGUpIHtcbiAgICBsaXN0ZW5lcnNTdG9yYWdlWygwLCBfZ2V0RG9tTm9kZUlkMi5kZWZhdWx0KShlLnRhcmdldCldW2UudHlwZV0obmV3IF9TeW50aGV0aWNFdmVudDIuZGVmYXVsdChlLnR5cGUsIGUpKTtcbn1cblxuaWYgKGRvYykge1xuICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICAgIHZhciBmb2N1c0V2ZW50cyA9IHtcbiAgICAgICAgICAgIGZvY3VzOiAnZm9jdXNpbicsXG4gICAgICAgICAgICBibHVyOiAnZm9jdXNvdXQnXG4gICAgICAgIH07XG5cbiAgICAgICAgdmFyIGkgPSAwLFxuICAgICAgICAgICAgdHlwZSA9IHVuZGVmaW5lZDtcblxuICAgICAgICB3aGlsZSAoaSA8IEJVQkJMRUFCTEVfTkFUSVZFX0VWRU5UUy5sZW5ndGgpIHtcbiAgICAgICAgICAgIHR5cGUgPSBCVUJCTEVBQkxFX05BVElWRV9FVkVOVFNbaSsrXTtcbiAgICAgICAgICAgIGV2ZW50c0NmZ1t0eXBlXSA9IHtcbiAgICAgICAgICAgICAgICB0eXBlOiB0eXBlLFxuICAgICAgICAgICAgICAgIGJ1YmJsZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgbGlzdGVuZXJzQ291bnRlcjogMCxcbiAgICAgICAgICAgICAgICBzZXQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHNldHVwOiBmb2N1c0V2ZW50c1t0eXBlXSA/ICgwLCBfaXNFdmVudFN1cHBvcnRlZDIuZGVmYXVsdCkoZm9jdXNFdmVudHNbdHlwZV0pID8gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgdHlwZSA9IHRoaXMudHlwZTtcbiAgICAgICAgICAgICAgICAgICAgZG9jLmFkZEV2ZW50TGlzdGVuZXIoZm9jdXNFdmVudHNbdHlwZV0sIGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBnbG9iYWxFdmVudExpc3RlbmVyKGUsIHR5cGUpO1xuICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICB9IDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBkb2MuYWRkRXZlbnRMaXN0ZW5lcih0aGlzLnR5cGUsIGdsb2JhbEV2ZW50TGlzdGVuZXIsIHRydWUpO1xuICAgICAgICAgICAgICAgIH0gOiBudWxsXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgaSA9IDA7XG4gICAgICAgIHdoaWxlIChpIDwgTk9OX0JVQkJMRUFCTEVfTkFUSVZFX0VWRU5UUy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGV2ZW50c0NmZ1tOT05fQlVCQkxFQUJMRV9OQVRJVkVfRVZFTlRTW2krK11dID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgICAgICAgICAgYnViYmxlczogZmFsc2UsXG4gICAgICAgICAgICAgICAgc2V0OiBmYWxzZVxuICAgICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgIH0pKCk7XG59XG5cbmZ1bmN0aW9uIGFkZExpc3RlbmVyKGRvbU5vZGUsIHR5cGUsIGxpc3RlbmVyKSB7XG4gICAgdmFyIGNmZyA9IGV2ZW50c0NmZ1t0eXBlXTtcbiAgICBpZiAoY2ZnKSB7XG4gICAgICAgIGlmICghY2ZnLnNldCkge1xuICAgICAgICAgICAgY2ZnLnNldHVwID8gY2ZnLnNldHVwKCkgOiBjZmcuYnViYmxlcyAmJiBkb2MuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBnbG9iYWxFdmVudExpc3RlbmVyLCBmYWxzZSk7XG4gICAgICAgICAgICBjZmcuc2V0ID0gdHJ1ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBkb21Ob2RlSWQgPSAoMCwgX2dldERvbU5vZGVJZDIuZGVmYXVsdCkoZG9tTm9kZSksXG4gICAgICAgICAgICBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNTdG9yYWdlW2RvbU5vZGVJZF0gfHwgKGxpc3RlbmVyc1N0b3JhZ2VbZG9tTm9kZUlkXSA9IHt9KTtcblxuICAgICAgICBpZiAoIWxpc3RlbmVyc1t0eXBlXSkge1xuICAgICAgICAgICAgY2ZnLmJ1YmJsZXMgPyArK2NmZy5saXN0ZW5lcnNDb3VudGVyIDogZG9tTm9kZS5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGV2ZW50TGlzdGVuZXIsIGZhbHNlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxpc3RlbmVyc1t0eXBlXSA9IGxpc3RlbmVyO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlTGlzdGVuZXIoZG9tTm9kZSwgdHlwZSkge1xuICAgIHZhciBkb21Ob2RlSWQgPSAoMCwgX2dldERvbU5vZGVJZDIuZGVmYXVsdCkoZG9tTm9kZSwgdHJ1ZSk7XG5cbiAgICBpZiAoZG9tTm9kZUlkKSB7XG4gICAgICAgIHZhciBsaXN0ZW5lcnMgPSBsaXN0ZW5lcnNTdG9yYWdlW2RvbU5vZGVJZF07XG5cbiAgICAgICAgaWYgKGxpc3RlbmVycyAmJiBsaXN0ZW5lcnNbdHlwZV0pIHtcbiAgICAgICAgICAgIGxpc3RlbmVyc1t0eXBlXSA9IG51bGw7XG5cbiAgICAgICAgICAgIHZhciBjZmcgPSBldmVudHNDZmdbdHlwZV07XG5cbiAgICAgICAgICAgIGlmIChjZmcpIHtcbiAgICAgICAgICAgICAgICBjZmcuYnViYmxlcyA/IC0tY2ZnLmxpc3RlbmVyc0NvdW50ZXIgOiBkb21Ob2RlLnJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgZXZlbnRMaXN0ZW5lcik7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUxpc3RlbmVycyhkb21Ob2RlKSB7XG4gICAgdmFyIGRvbU5vZGVJZCA9ICgwLCBfZ2V0RG9tTm9kZUlkMi5kZWZhdWx0KShkb21Ob2RlLCB0cnVlKTtcblxuICAgIGlmIChkb21Ob2RlSWQpIHtcbiAgICAgICAgdmFyIGxpc3RlbmVycyA9IGxpc3RlbmVyc1N0b3JhZ2VbZG9tTm9kZUlkXTtcblxuICAgICAgICBpZiAobGlzdGVuZXJzKSB7XG4gICAgICAgICAgICBkZWxldGUgbGlzdGVuZXJzU3RvcmFnZVtkb21Ob2RlSWRdO1xuICAgICAgICAgICAgZm9yICh2YXIgdHlwZSBpbiBsaXN0ZW5lcnMpIHtcbiAgICAgICAgICAgICAgICByZW1vdmVMaXN0ZW5lcihkb21Ob2RlLCB0eXBlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuZXhwb3J0cy5hZGRMaXN0ZW5lciA9IGFkZExpc3RlbmVyO1xuZXhwb3J0cy5yZW1vdmVMaXN0ZW5lciA9IHJlbW92ZUxpc3RlbmVyO1xuZXhwb3J0cy5yZW1vdmVMaXN0ZW5lcnMgPSByZW1vdmVMaXN0ZW5lcnM7IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xuXG5mdW5jdGlvbiBpc0V2ZW50U3VwcG9ydGVkKHR5cGUpIHtcbiAgICB2YXIgZXZlbnRQcm9wID0gJ29uJyArIHR5cGU7XG5cbiAgICBpZiAoZXZlbnRQcm9wIGluIGRvYykge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICB2YXIgZG9tTm9kZSA9IGRvYy5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblxuICAgIGRvbU5vZGUuc2V0QXR0cmlidXRlKGV2ZW50UHJvcCwgJ3JldHVybjsnKTtcbiAgICBpZiAodHlwZW9mIGRvbU5vZGVbZXZlbnRQcm9wXSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICByZXR1cm4gdHlwZSA9PT0gJ3doZWVsJyAmJiBkb2MuaW1wbGVtZW50YXRpb24gJiYgZG9jLmltcGxlbWVudGF0aW9uLmhhc0ZlYXR1cmUgJiYgZG9jLmltcGxlbWVudGF0aW9uLmhhc0ZlYXR1cmUoJycsICcnKSAhPT0gdHJ1ZSAmJiBkb2MuaW1wbGVtZW50YXRpb24uaGFzRmVhdHVyZSgnRXZlbnRzLndoZWVsJywgJzMuMCcpO1xufVxuXG5leHBvcnRzLmRlZmF1bHQgPSBpc0V2ZW50U3VwcG9ydGVkOyIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xudmFyIElEX1BST1AgPSAnX192aWRvbV9faWRfXyc7XG52YXIgY291bnRlciA9IDE7XG5cbmZ1bmN0aW9uIGdldERvbU5vZGVJZChub2RlLCBvbmx5R2V0KSB7XG4gICAgcmV0dXJuIG5vZGVbSURfUFJPUF0gfHwgKG9ubHlHZXQgPyBudWxsIDogbm9kZVtJRF9QUk9QXSA9IGNvdW50ZXIrKyk7XG59XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGdldERvbU5vZGVJZDsiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMubW91bnRUb0RvbSA9IG1vdW50VG9Eb207XG5leHBvcnRzLm1vdW50VG9Eb21TeW5jID0gbW91bnRUb0RvbVN5bmM7XG5leHBvcnRzLnVubW91bnRGcm9tRG9tID0gdW5tb3VudEZyb21Eb207XG5leHBvcnRzLnVubW91bnRGcm9tRG9tU3luYyA9IHVubW91bnRGcm9tRG9tU3luYztcblxudmFyIF9nZXREb21Ob2RlSWQgPSByZXF1aXJlKCcuL2dldERvbU5vZGVJZCcpO1xuXG52YXIgX2dldERvbU5vZGVJZDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9nZXREb21Ob2RlSWQpO1xuXG52YXIgX3JhZkJhdGNoID0gcmVxdWlyZSgnLi9yYWZCYXRjaCcpO1xuXG52YXIgX3JhZkJhdGNoMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3JhZkJhdGNoKTtcblxudmFyIF9lbXB0eU9iaiA9IHJlcXVpcmUoJy4uL3V0aWxzL2VtcHR5T2JqJyk7XG5cbnZhciBfZW1wdHlPYmoyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZW1wdHlPYmopO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG52YXIgbW91bnRlZE5vZGVzID0ge307XG52YXIgY291bnRlciA9IDA7XG5cbmZ1bmN0aW9uIG1vdW50KGRvbU5vZGUsIHRyZWUsIGNiLCBjYkN0eCwgc3luY01vZGUpIHtcbiAgICB2YXIgZG9tTm9kZUlkID0gKDAsIF9nZXREb21Ob2RlSWQyLmRlZmF1bHQpKGRvbU5vZGUpLFxuICAgICAgICBtb3VudGVkID0gbW91bnRlZE5vZGVzW2RvbU5vZGVJZF0sXG4gICAgICAgIG1vdW50SWQgPSB1bmRlZmluZWQ7XG5cbiAgICBpZiAobW91bnRlZCAmJiBtb3VudGVkLnRyZWUpIHtcbiAgICAgICAgbW91bnRJZCA9ICsrbW91bnRlZC5pZDtcbiAgICAgICAgdmFyIHBhdGNoRm4gPSBmdW5jdGlvbiBwYXRjaEZuKCkge1xuICAgICAgICAgICAgaWYgKG1vdW50ZWROb2Rlc1tkb21Ob2RlSWRdICYmIG1vdW50ZWROb2Rlc1tkb21Ob2RlSWRdLmlkID09PSBtb3VudElkKSB7XG4gICAgICAgICAgICAgICAgbW91bnRlZC50cmVlLnBhdGNoKHRyZWUpO1xuICAgICAgICAgICAgICAgIG1vdW50ZWQudHJlZSA9IHRyZWU7XG4gICAgICAgICAgICAgICAgY2FsbENiKGNiLCBjYkN0eCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICAgIHN5bmNNb2RlID8gcGF0Y2hGbigpIDogKDAsIF9yYWZCYXRjaDIuZGVmYXVsdCkocGF0Y2hGbik7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgbW91bnRlZE5vZGVzW2RvbU5vZGVJZF0gPSB7IHRyZWU6IG51bGwsIGlkOiBtb3VudElkID0gKytjb3VudGVyIH07XG5cbiAgICAgICAgdmFyIGV4aXN0aW5nRG9tID0gZG9tTm9kZS5maXJzdEVsZW1lbnRDaGlsZDtcbiAgICAgICAgaWYgKGV4aXN0aW5nRG9tKSB7XG4gICAgICAgICAgICBtb3VudGVkTm9kZXNbZG9tTm9kZUlkXS50cmVlID0gdHJlZTtcbiAgICAgICAgICAgIHRyZWUuYWRvcHREb20oZXhpc3RpbmdEb20pO1xuICAgICAgICAgICAgdHJlZS5tb3VudCgpO1xuICAgICAgICAgICAgY2FsbENiKGNiLCBjYkN0eCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgcmVuZGVyRm4gPSBmdW5jdGlvbiByZW5kZXJGbigpIHtcbiAgICAgICAgICAgICAgICBpZiAobW91bnRlZE5vZGVzW2RvbU5vZGVJZF0gJiYgbW91bnRlZE5vZGVzW2RvbU5vZGVJZF0uaWQgPT09IG1vdW50SWQpIHtcbiAgICAgICAgICAgICAgICAgICAgbW91bnRlZE5vZGVzW2RvbU5vZGVJZF0udHJlZSA9IHRyZWU7XG4gICAgICAgICAgICAgICAgICAgIGRvbU5vZGUuYXBwZW5kQ2hpbGQodHJlZS5yZW5kZXJUb0RvbSgpKTtcbiAgICAgICAgICAgICAgICAgICAgdHJlZS5tb3VudCgpO1xuICAgICAgICAgICAgICAgICAgICBjYWxsQ2IoY2IsIGNiQ3R4KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBzeW5jTW9kZSA/IHJlbmRlckZuKCkgOiAoMCwgX3JhZkJhdGNoMi5kZWZhdWx0KShyZW5kZXJGbik7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHVubW91bnQoZG9tTm9kZSwgY2IsIGNiQ3R4LCBzeW5jTW9kZSkge1xuICAgIHZhciBkb21Ob2RlSWQgPSAoMCwgX2dldERvbU5vZGVJZDIuZGVmYXVsdCkoZG9tTm9kZSk7XG4gICAgdmFyIG1vdW50ZWQgPSBtb3VudGVkTm9kZXNbZG9tTm9kZUlkXTtcblxuICAgIGlmIChtb3VudGVkKSB7XG4gICAgICAgIChmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB2YXIgbW91bnRJZCA9ICsrbW91bnRlZC5pZCxcbiAgICAgICAgICAgICAgICB1bm1vdW50Rm4gPSBmdW5jdGlvbiB1bm1vdW50Rm4oKSB7XG4gICAgICAgICAgICAgICAgbW91bnRlZCA9IG1vdW50ZWROb2Rlc1tkb21Ob2RlSWRdO1xuICAgICAgICAgICAgICAgIGlmIChtb3VudGVkICYmIG1vdW50ZWQuaWQgPT09IG1vdW50SWQpIHtcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIG1vdW50ZWROb2Rlc1tkb21Ob2RlSWRdO1xuICAgICAgICAgICAgICAgICAgICB2YXIgdHJlZSA9IG1vdW50ZWQudHJlZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRyZWUpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhciB0cmVlRG9tTm9kZSA9IHRyZWUuZ2V0RG9tTm9kZSgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgdHJlZS51bm1vdW50KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBkb21Ob2RlLnJlbW92ZUNoaWxkKHRyZWVEb21Ob2RlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYWxsQ2IoY2IsIGNiQ3R4KTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBtb3VudGVkLnRyZWUgPyBzeW5jTW9kZSA/IHVubW91bnRGbigpIDogKDAsIF9yYWZCYXRjaDIuZGVmYXVsdCkodW5tb3VudEZuKSA6IHN5bmNNb2RlIHx8IGNhbGxDYihjYiwgY2JDdHgpO1xuICAgICAgICB9KSgpO1xuICAgIH0gZWxzZSBpZiAoIXN5bmNNb2RlKSB7XG4gICAgICAgIGNhbGxDYihjYiwgY2JDdHgpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gY2FsbENiKGNiLCBjYkN0eCkge1xuICAgIGNiICYmIGNiLmNhbGwoY2JDdHggfHwgdGhpcyk7XG59XG5cbmZ1bmN0aW9uIG1vdW50VG9Eb20oZG9tTm9kZSwgdHJlZSwgY2IsIGNiQ3R4KSB7XG4gICAgbW91bnQoZG9tTm9kZSwgdHJlZSwgY2IsIGNiQ3R4LCBmYWxzZSk7XG59XG5cbmZ1bmN0aW9uIG1vdW50VG9Eb21TeW5jKGRvbU5vZGUsIHRyZWUpIHtcbiAgICBtb3VudChkb21Ob2RlLCB0cmVlLCBudWxsLCBudWxsLCB0cnVlKTtcbn1cblxuZnVuY3Rpb24gdW5tb3VudEZyb21Eb20oZG9tTm9kZSwgY2IsIGNiQ3R4KSB7XG4gICAgdW5tb3VudChkb21Ob2RlLCBjYiwgY2JDdHgsIGZhbHNlKTtcbn1cblxuZnVuY3Rpb24gdW5tb3VudEZyb21Eb21TeW5jKGRvbU5vZGUpIHtcbiAgICB1bm1vdW50KGRvbU5vZGUsIG51bGwsIG51bGwsIHRydWUpO1xufSIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX2RvbUF0dHJzID0gcmVxdWlyZSgnLi9kb21BdHRycycpO1xuXG52YXIgX2RvbUF0dHJzMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2RvbUF0dHJzKTtcblxudmFyIF9kb21FdmVudE1hbmFnZXIgPSByZXF1aXJlKCcuL2V2ZW50cy9kb21FdmVudE1hbmFnZXInKTtcblxudmFyIF9hdHRyc1RvRXZlbnRzID0gcmVxdWlyZSgnLi9ldmVudHMvYXR0cnNUb0V2ZW50cycpO1xuXG52YXIgX2F0dHJzVG9FdmVudHMyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfYXR0cnNUb0V2ZW50cyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG5cbmZ1bmN0aW9uIGFwcGVuZENoaWxkKHBhcmVudE5vZGUsIGNoaWxkTm9kZSkge1xuICAgIHBhcmVudE5vZGUuZ2V0RG9tTm9kZSgpLmFwcGVuZENoaWxkKGNoaWxkTm9kZS5yZW5kZXJUb0RvbShwYXJlbnROb2RlKSk7XG4gICAgY2hpbGROb2RlLm1vdW50KCk7XG59XG5cbmZ1bmN0aW9uIGluc2VydENoaWxkKHBhcmVudE5vZGUsIGNoaWxkTm9kZSwgYmVmb3JlQ2hpbGROb2RlKSB7XG4gICAgcGFyZW50Tm9kZS5nZXREb21Ob2RlKCkuaW5zZXJ0QmVmb3JlKGNoaWxkTm9kZS5yZW5kZXJUb0RvbShwYXJlbnROb2RlKSwgYmVmb3JlQ2hpbGROb2RlLmdldERvbU5vZGUoKSk7XG4gICAgY2hpbGROb2RlLm1vdW50KCk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUNoaWxkKHBhcmVudE5vZGUsIGNoaWxkTm9kZSkge1xuICAgIHZhciBjaGlsZERvbU5vZGUgPSBjaGlsZE5vZGUuZ2V0RG9tTm9kZSgpO1xuICAgIGNoaWxkTm9kZS51bm1vdW50KCk7XG4gICAgcGFyZW50Tm9kZS5nZXREb21Ob2RlKCkucmVtb3ZlQ2hpbGQoY2hpbGREb21Ob2RlKTtcbn1cblxuZnVuY3Rpb24gbW92ZUNoaWxkKHBhcmVudE5vZGUsIGNoaWxkTm9kZSwgdG9DaGlsZE5vZGUsIGFmdGVyKSB7XG4gICAgdmFyIHBhcmVudERvbU5vZGUgPSBwYXJlbnROb2RlLmdldERvbU5vZGUoKSxcbiAgICAgICAgY2hpbGREb21Ob2RlID0gY2hpbGROb2RlLmdldERvbU5vZGUoKSxcbiAgICAgICAgdG9DaGlsZERvbU5vZGUgPSB0b0NoaWxkTm9kZS5nZXREb21Ob2RlKCksXG4gICAgICAgIGFjdGl2ZURvbU5vZGUgPSBkb2MuYWN0aXZlRWxlbWVudDtcblxuICAgIGlmIChhZnRlcikge1xuICAgICAgICB2YXIgbmV4dFNpYmxpbmdEb21Ob2RlID0gdG9DaGlsZERvbU5vZGUubmV4dFNpYmxpbmc7XG4gICAgICAgIG5leHRTaWJsaW5nRG9tTm9kZSA/IHBhcmVudERvbU5vZGUuaW5zZXJ0QmVmb3JlKGNoaWxkRG9tTm9kZSwgbmV4dFNpYmxpbmdEb21Ob2RlKSA6IHBhcmVudERvbU5vZGUuYXBwZW5kQ2hpbGQoY2hpbGREb21Ob2RlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBwYXJlbnREb21Ob2RlLmluc2VydEJlZm9yZShjaGlsZERvbU5vZGUsIHRvQ2hpbGREb21Ob2RlKTtcbiAgICB9XG5cbiAgICBpZiAoZG9jLmFjdGl2ZUVsZW1lbnQgIT09IGFjdGl2ZURvbU5vZGUpIHtcbiAgICAgICAgYWN0aXZlRG9tTm9kZS5mb2N1cygpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlQ2hpbGRyZW4ocGFyZW50Tm9kZSkge1xuICAgIHZhciBjaGlsZE5vZGVzID0gcGFyZW50Tm9kZS5fY2hpbGRyZW4sXG4gICAgICAgIGxlbiA9IGNoaWxkTm9kZXMubGVuZ3RoO1xuXG4gICAgdmFyIGogPSAwO1xuXG4gICAgd2hpbGUgKGogPCBsZW4pIHtcbiAgICAgICAgY2hpbGROb2Rlc1tqKytdLnVubW91bnQoKTtcbiAgICB9XG5cbiAgICBwYXJlbnROb2RlLmdldERvbU5vZGUoKS5pbm5lckhUTUwgPSAnJztcbn1cblxuZnVuY3Rpb24gcmVwbGFjZShwYXJlbnROb2RlLCBvbGROb2RlLCBuZXdOb2RlKSB7XG4gICAgdmFyIG9sZERvbU5vZGUgPSBvbGROb2RlLmdldERvbU5vZGUoKTtcblxuICAgIG9sZE5vZGUudW5tb3VudCgpO1xuICAgIG9sZERvbU5vZGUucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQobmV3Tm9kZS5yZW5kZXJUb0RvbShwYXJlbnROb2RlKSwgb2xkRG9tTm9kZSk7XG4gICAgbmV3Tm9kZS5tb3VudCgpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVBdHRyKG5vZGUsIGF0dHJOYW1lLCBhdHRyVmFsKSB7XG4gICAgdmFyIGRvbU5vZGUgPSBub2RlLmdldERvbU5vZGUoKTtcblxuICAgIF9hdHRyc1RvRXZlbnRzMi5kZWZhdWx0W2F0dHJOYW1lXSA/ICgwLCBfZG9tRXZlbnRNYW5hZ2VyLmFkZExpc3RlbmVyKShkb21Ob2RlLCBfYXR0cnNUb0V2ZW50czIuZGVmYXVsdFthdHRyTmFtZV0sIGF0dHJWYWwpIDogKDAsIF9kb21BdHRyczIuZGVmYXVsdCkoYXR0ck5hbWUpLnNldChkb21Ob2RlLCBhdHRyTmFtZSwgYXR0clZhbCk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUF0dHIobm9kZSwgYXR0ck5hbWUpIHtcbiAgICB2YXIgZG9tTm9kZSA9IG5vZGUuZ2V0RG9tTm9kZSgpO1xuXG4gICAgX2F0dHJzVG9FdmVudHMyLmRlZmF1bHRbYXR0ck5hbWVdID8gKDAsIF9kb21FdmVudE1hbmFnZXIucmVtb3ZlTGlzdGVuZXIpKGRvbU5vZGUsIF9hdHRyc1RvRXZlbnRzMi5kZWZhdWx0W2F0dHJOYW1lXSkgOiAoMCwgX2RvbUF0dHJzMi5kZWZhdWx0KShhdHRyTmFtZSkucmVtb3ZlKGRvbU5vZGUsIGF0dHJOYW1lKTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlVGV4dChub2RlLCB0ZXh0LCBlc2NhcGUpIHtcbiAgICB2YXIgZG9tTm9kZSA9IG5vZGUuZ2V0RG9tTm9kZSgpO1xuICAgIGVzY2FwZSA/IGRvbU5vZGUudGV4dENvbnRlbnQgPSB0ZXh0IDogZG9tTm9kZS5pbm5lckhUTUwgPSB0ZXh0O1xufVxuXG5mdW5jdGlvbiByZW1vdmVUZXh0KHBhcmVudE5vZGUpIHtcbiAgICBwYXJlbnROb2RlLmdldERvbU5vZGUoKS5pbm5lckhUTUwgPSAnJztcbn1cblxuZXhwb3J0cy5kZWZhdWx0ID0ge1xuICAgIGFwcGVuZENoaWxkOiBhcHBlbmRDaGlsZCxcbiAgICBpbnNlcnRDaGlsZDogaW5zZXJ0Q2hpbGQsXG4gICAgcmVtb3ZlQ2hpbGQ6IHJlbW92ZUNoaWxkLFxuICAgIG1vdmVDaGlsZDogbW92ZUNoaWxkLFxuICAgIHJlbW92ZUNoaWxkcmVuOiByZW1vdmVDaGlsZHJlbixcbiAgICByZXBsYWNlOiByZXBsYWNlLFxuICAgIHVwZGF0ZUF0dHI6IHVwZGF0ZUF0dHIsXG4gICAgcmVtb3ZlQXR0cjogcmVtb3ZlQXR0cixcbiAgICB1cGRhdGVUZXh0OiB1cGRhdGVUZXh0LFxuICAgIHJlbW92ZVRleHQ6IHJlbW92ZVRleHRcbn07IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcbnZhciByYWYgPSBnbG9iYWwucmVxdWVzdEFuaW1hdGlvbkZyYW1lIHx8IGdsb2JhbC53ZWJraXRSZXF1ZXN0QW5pbWF0aW9uRnJhbWUgfHwgZ2xvYmFsLm1velJlcXVlc3RBbmltYXRpb25GcmFtZSB8fCBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICBzZXRUaW1lb3V0KGNhbGxiYWNrLCAxMDAwIC8gNjApO1xufTtcblxudmFyIGJhdGNoID0gW107XG5cbmZ1bmN0aW9uIGFwcGx5QmF0Y2goKSB7XG4gICAgdmFyIGkgPSAwO1xuXG4gICAgd2hpbGUgKGkgPCBiYXRjaC5sZW5ndGgpIHtcbiAgICAgICAgYmF0Y2hbaSsrXSgpO1xuICAgIH1cblxuICAgIGJhdGNoID0gW107XG59XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGZ1bmN0aW9uIChmbikge1xuICAgIGJhdGNoLnB1c2goZm4pID09PSAxICYmIHJhZihhcHBseUJhdGNoKTtcbn07XG5cbmV4cG9ydHMuYXBwbHlCYXRjaCA9IGFwcGx5QmF0Y2g7IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50LFxuICAgIGVsZW1lbnRQcm90b3MgPSB7fTtcblxuZnVuY3Rpb24gY3JlYXRlRWxlbWVudChucywgdGFnKSB7XG4gICAgdmFyIGJhc2VFbGVtZW50ID0gdW5kZWZpbmVkO1xuICAgIGlmIChucykge1xuICAgICAgICB2YXIga2V5ID0gbnMgKyAnOicgKyB0YWc7XG4gICAgICAgIGJhc2VFbGVtZW50ID0gZWxlbWVudFByb3Rvc1trZXldIHx8IChlbGVtZW50UHJvdG9zW2tleV0gPSBkb2MuY3JlYXRlRWxlbWVudE5TKG5zLCB0YWcpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgICBiYXNlRWxlbWVudCA9IGVsZW1lbnRQcm90b3NbdGFnXSB8fCAoZWxlbWVudFByb3Rvc1t0YWddID0gZG9jLmNyZWF0ZUVsZW1lbnQodGFnKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGJhc2VFbGVtZW50LmNsb25lTm9kZSgpO1xufVxuXG5leHBvcnRzLmRlZmF1bHQgPSBjcmVhdGVFbGVtZW50OyIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudCxcbiAgICBUT1BfTEVWRUxfTlNfVEFHUyA9IHtcbiAgICAnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnOiAnc3ZnJyxcbiAgICAnaHR0cDovL3d3dy53My5vcmcvMTk5OC9NYXRoL01hdGhNTCc6ICdtYXRoJ1xufTtcblxudmFyIGhlbHBlckRvbU5vZGUgPSB1bmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGNyZWF0ZUVsZW1lbnRCeUh0bWwoaHRtbCwgdGFnLCBucykge1xuICAgIGhlbHBlckRvbU5vZGUgfHwgKGhlbHBlckRvbU5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKSk7XG5cbiAgICBpZiAoIW5zIHx8ICFUT1BfTEVWRUxfTlNfVEFHU1tuc10gfHwgVE9QX0xFVkVMX05TX1RBR1NbbnNdID09PSB0YWcpIHtcbiAgICAgICAgaGVscGVyRG9tTm9kZS5pbm5lckhUTUwgPSBodG1sO1xuICAgICAgICByZXR1cm4gaGVscGVyRG9tTm9kZS5yZW1vdmVDaGlsZChoZWxwZXJEb21Ob2RlLmZpcnN0Q2hpbGQpO1xuICAgIH1cblxuICAgIHZhciB0b3BMZXZlbFRhZyA9IFRPUF9MRVZFTF9OU19UQUdTW25zXTtcbiAgICBoZWxwZXJEb21Ob2RlLmlubmVySFRNTCA9ICc8JyArIHRvcExldmVsVGFnICsgJyB4bWxucz1cIicgKyBucyArICdcIj4nICsgaHRtbCArICc8LycgKyB0b3BMZXZlbFRhZyArICc+JztcbiAgICByZXR1cm4gaGVscGVyRG9tTm9kZS5yZW1vdmVDaGlsZChoZWxwZXJEb21Ob2RlLmZpcnN0Q2hpbGQpLmZpcnN0Q2hpbGQ7XG59XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGNyZWF0ZUVsZW1lbnRCeUh0bWw7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgX2V4dGVuZHMgPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uICh0YXJnZXQpIHsgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHsgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTsgZm9yICh2YXIga2V5IGluIHNvdXJjZSkgeyBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHNvdXJjZSwga2V5KSkgeyB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldOyB9IH0gfSByZXR1cm4gdGFyZ2V0OyB9O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG5cbnZhciBfY3JlYXRlQ29tcG9uZW50ID0gcmVxdWlyZSgnLi4vY3JlYXRlQ29tcG9uZW50Jyk7XG5cbnZhciBfY3JlYXRlQ29tcG9uZW50MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2NyZWF0ZUNvbXBvbmVudCk7XG5cbnZhciBfVGFnTm9kZSA9IHJlcXVpcmUoJy4uL25vZGVzL1RhZ05vZGUnKTtcblxudmFyIF9UYWdOb2RlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX1RhZ05vZGUpO1xuXG52YXIgX3JhZkJhdGNoID0gcmVxdWlyZSgnLi4vY2xpZW50L3JhZkJhdGNoJyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbmV4cG9ydHMuZGVmYXVsdCA9ICgwLCBfY3JlYXRlQ29tcG9uZW50Mi5kZWZhdWx0KSh7XG4gICAgb25Jbml0OiBmdW5jdGlvbiBvbkluaXQoKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5vbklucHV0ID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIHZhciBhdHRycyA9IF90aGlzLmdldEF0dHJzKCk7XG5cbiAgICAgICAgICAgIGF0dHJzLm9uSW5wdXQgJiYgYXR0cnMub25JbnB1dChlKTtcbiAgICAgICAgICAgIGF0dHJzLm9uQ2hhbmdlICYmIGF0dHJzLm9uQ2hhbmdlKGUpO1xuXG4gICAgICAgICAgICAoMCwgX3JhZkJhdGNoLmFwcGx5QmF0Y2gpKCk7XG5cbiAgICAgICAgICAgIGlmIChfdGhpcy5pc01vdW50ZWQoKSkge1xuICAgICAgICAgICAgICAgIC8vIGF0dHJzIGNvdWxkIGJlIGNoYW5nZWQgZHVyaW5nIGFwcGx5QmF0Y2goKVxuICAgICAgICAgICAgICAgIGF0dHJzID0gX3RoaXMuZ2V0QXR0cnMoKTtcbiAgICAgICAgICAgICAgICB2YXIgY29udHJvbCA9IF90aGlzLmdldERvbVJlZignY29udHJvbCcpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYXR0cnMudmFsdWUgIT09ICd1bmRlZmluZWQnICYmIGNvbnRyb2wudmFsdWUgIT09IGF0dHJzLnZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRyb2wudmFsdWUgPSBhdHRycy52YWx1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG5cbiAgICAgICAgdGhpcy5vbkNsaWNrID0gZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgICAgIHZhciBhdHRycyA9IF90aGlzLmdldEF0dHJzKCk7XG5cbiAgICAgICAgICAgIGF0dHJzLm9uQ2xpY2sgJiYgYXR0cnMub25DbGljayhlKTtcbiAgICAgICAgICAgIGF0dHJzLm9uQ2hhbmdlICYmIGF0dHJzLm9uQ2hhbmdlKGUpO1xuXG4gICAgICAgICAgICAoMCwgX3JhZkJhdGNoLmFwcGx5QmF0Y2gpKCk7XG5cbiAgICAgICAgICAgIGlmIChfdGhpcy5pc01vdW50ZWQoKSkge1xuICAgICAgICAgICAgICAgIC8vIGF0dHJzIGNvdWxkIGJlIGNoYW5nZWQgZHVyaW5nIGFwcGx5QmF0Y2goKVxuICAgICAgICAgICAgICAgIGF0dHJzID0gX3RoaXMuZ2V0QXR0cnMoKTtcbiAgICAgICAgICAgICAgICB2YXIgY29udHJvbCA9IF90aGlzLmdldERvbVJlZignY29udHJvbCcpO1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgYXR0cnMuY2hlY2tlZCAhPT0gJ3VuZGVmaW5lZCcgJiYgY29udHJvbC5jaGVja2VkICE9PSBhdHRycy5jaGVja2VkKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRyb2wuY2hlY2tlZCA9IGF0dHJzLmNoZWNrZWQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgb25SZW5kZXI6IGZ1bmN0aW9uIG9uUmVuZGVyKGF0dHJzKSB7XG4gICAgICAgIHZhciBjb250cm9sQXR0cnMgPSB1bmRlZmluZWQ7XG5cbiAgICAgICAgaWYgKGF0dHJzLnR5cGUgPT09ICdmaWxlJykge1xuICAgICAgICAgICAgY29udHJvbEF0dHJzID0gYXR0cnM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb250cm9sQXR0cnMgPSBfZXh0ZW5kcyh7fSwgYXR0cnMsIHsgb25DaGFuZ2U6IG51bGwgfSk7XG5cbiAgICAgICAgICAgIGlmIChhdHRycy50eXBlID09PSAnY2hlY2tib3gnIHx8IGF0dHJzLnR5cGUgPT09ICdyYWRpbycpIHtcbiAgICAgICAgICAgICAgICBjb250cm9sQXR0cnMub25DbGljayA9IHRoaXMub25DbGljaztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgY29udHJvbEF0dHJzLm9uSW5wdXQgPSB0aGlzLm9uSW5wdXQ7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5zZXREb21SZWYoJ2NvbnRyb2wnLCBuZXcgX1RhZ05vZGUyLmRlZmF1bHQoJ2lucHV0JykuYXR0cnMoY29udHJvbEF0dHJzKSk7XG4gICAgfVxufSk7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgX2V4dGVuZHMgPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uICh0YXJnZXQpIHsgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHsgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTsgZm9yICh2YXIga2V5IGluIHNvdXJjZSkgeyBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHNvdXJjZSwga2V5KSkgeyB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldOyB9IH0gfSByZXR1cm4gdGFyZ2V0OyB9O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG5cbnZhciBfY3JlYXRlQ29tcG9uZW50ID0gcmVxdWlyZSgnLi4vY3JlYXRlQ29tcG9uZW50Jyk7XG5cbnZhciBfY3JlYXRlQ29tcG9uZW50MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2NyZWF0ZUNvbXBvbmVudCk7XG5cbnZhciBfVGFnTm9kZSA9IHJlcXVpcmUoJy4uL25vZGVzL1RhZ05vZGUnKTtcblxudmFyIF9UYWdOb2RlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX1RhZ05vZGUpO1xuXG52YXIgX3JhZkJhdGNoID0gcmVxdWlyZSgnLi4vY2xpZW50L3JhZkJhdGNoJyk7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbmV4cG9ydHMuZGVmYXVsdCA9ICgwLCBfY3JlYXRlQ29tcG9uZW50Mi5kZWZhdWx0KSh7XG4gICAgb25Jbml0OiBmdW5jdGlvbiBvbkluaXQoKSB7XG4gICAgICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICAgICAgdGhpcy5vbkNoYW5nZSA9IGZ1bmN0aW9uIChlKSB7XG4gICAgICAgICAgICB2YXIgYXR0cnMgPSBfdGhpcy5nZXRBdHRycygpO1xuXG4gICAgICAgICAgICBhdHRycy5vbkNoYW5nZSAmJiBhdHRycy5vbkNoYW5nZShlKTtcblxuICAgICAgICAgICAgKDAsIF9yYWZCYXRjaC5hcHBseUJhdGNoKSgpO1xuXG4gICAgICAgICAgICBpZiAoX3RoaXMuaXNNb3VudGVkKCkpIHtcbiAgICAgICAgICAgICAgICAvLyBhdHRycyBjb3VsZCBiZSBjaGFuZ2VkIGR1cmluZyBhcHBseUJhdGNoKClcbiAgICAgICAgICAgICAgICBhdHRycyA9IF90aGlzLmdldEF0dHJzKCk7XG4gICAgICAgICAgICAgICAgdmFyIGNvbnRyb2wgPSBfdGhpcy5nZXREb21SZWYoJ2NvbnRyb2wnKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGF0dHJzLnZhbHVlICE9PSAndW5kZWZpbmVkJyAmJiBjb250cm9sLnZhbHVlICE9PSBhdHRycy52YWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBjb250cm9sLnZhbHVlID0gYXR0cnMudmFsdWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH0sXG4gICAgb25SZW5kZXI6IGZ1bmN0aW9uIG9uUmVuZGVyKGF0dHJzLCBjaGlsZHJlbikge1xuICAgICAgICB2YXIgY29udHJvbEF0dHJzID0gX2V4dGVuZHMoe30sIGF0dHJzLCB7XG4gICAgICAgICAgICBvbkNoYW5nZTogdGhpcy5vbkNoYW5nZVxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdGhpcy5zZXREb21SZWYoJ2NvbnRyb2wnLCBuZXcgX1RhZ05vZGUyLmRlZmF1bHQoJ3NlbGVjdCcpLmF0dHJzKGNvbnRyb2xBdHRycykuY2hpbGRyZW4oY2hpbGRyZW4pKTtcbiAgICB9XG59KTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBfZXh0ZW5kcyA9IE9iamVjdC5hc3NpZ24gfHwgZnVuY3Rpb24gKHRhcmdldCkgeyBmb3IgKHZhciBpID0gMTsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykgeyB2YXIgc291cmNlID0gYXJndW1lbnRzW2ldOyBmb3IgKHZhciBrZXkgaW4gc291cmNlKSB7IGlmIChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoc291cmNlLCBrZXkpKSB7IHRhcmdldFtrZXldID0gc291cmNlW2tleV07IH0gfSB9IHJldHVybiB0YXJnZXQ7IH07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcblxudmFyIF9jcmVhdGVDb21wb25lbnQgPSByZXF1aXJlKCcuLi9jcmVhdGVDb21wb25lbnQnKTtcblxudmFyIF9jcmVhdGVDb21wb25lbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY3JlYXRlQ29tcG9uZW50KTtcblxudmFyIF9UYWdOb2RlID0gcmVxdWlyZSgnLi4vbm9kZXMvVGFnTm9kZScpO1xuXG52YXIgX1RhZ05vZGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfVGFnTm9kZSk7XG5cbnZhciBfcmFmQmF0Y2ggPSByZXF1aXJlKCcuLi9jbGllbnQvcmFmQmF0Y2gnKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuZXhwb3J0cy5kZWZhdWx0ID0gKDAsIF9jcmVhdGVDb21wb25lbnQyLmRlZmF1bHQpKHtcbiAgICBvbkluaXQ6IGZ1bmN0aW9uIG9uSW5pdCgpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgICAgICB0aGlzLm9uSW5wdXQgPSBmdW5jdGlvbiAoZSkge1xuICAgICAgICAgICAgdmFyIGF0dHJzID0gX3RoaXMuZ2V0QXR0cnMoKTtcblxuICAgICAgICAgICAgYXR0cnMub25JbnB1dCAmJiBhdHRycy5vbklucHV0KGUpO1xuICAgICAgICAgICAgYXR0cnMub25DaGFuZ2UgJiYgYXR0cnMub25DaGFuZ2UoZSk7XG5cbiAgICAgICAgICAgICgwLCBfcmFmQmF0Y2guYXBwbHlCYXRjaCkoKTtcblxuICAgICAgICAgICAgaWYgKF90aGlzLmlzTW91bnRlZCgpKSB7XG4gICAgICAgICAgICAgICAgLy8gYXR0cnMgY291bGQgYmUgY2hhbmdlZCBkdXJpbmcgYXBwbHlCYXRjaCgpXG4gICAgICAgICAgICAgICAgYXR0cnMgPSBfdGhpcy5nZXRBdHRycygpO1xuICAgICAgICAgICAgICAgIHZhciBjb250cm9sID0gX3RoaXMuZ2V0RG9tUmVmKCdjb250cm9sJyk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBhdHRycy52YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgJiYgY29udHJvbC52YWx1ZSAhPT0gYXR0cnMudmFsdWUpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udHJvbC52YWx1ZSA9IGF0dHJzLnZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9LFxuICAgIG9uUmVuZGVyOiBmdW5jdGlvbiBvblJlbmRlcihhdHRycykge1xuICAgICAgICB2YXIgY29udHJvbEF0dHJzID0gX2V4dGVuZHMoe30sIGF0dHJzLCB7XG4gICAgICAgICAgICBvbklucHV0OiB0aGlzLm9uSW5wdXQsXG4gICAgICAgICAgICBvbkNoYW5nZTogbnVsbFxuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdGhpcy5zZXREb21SZWYoJ2NvbnRyb2wnLCBuZXcgX1RhZ05vZGUyLmRlZmF1bHQoJ3RleHRhcmVhJykuYXR0cnMoY29udHJvbEF0dHJzKSk7XG4gICAgfVxufSk7IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgX2V4dGVuZHMgPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uICh0YXJnZXQpIHsgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHsgdmFyIHNvdXJjZSA9IGFyZ3VtZW50c1tpXTsgZm9yICh2YXIga2V5IGluIHNvdXJjZSkgeyBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHNvdXJjZSwga2V5KSkgeyB0YXJnZXRba2V5XSA9IHNvdXJjZVtrZXldOyB9IH0gfSByZXR1cm4gdGFyZ2V0OyB9O1xuXG52YXIgX3R5cGVvZiA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgU3ltYm9sLml0ZXJhdG9yID09PSBcInN5bWJvbFwiID8gZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gdHlwZW9mIG9iajsgfSA6IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIG9iaiAmJiB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb2JqLmNvbnN0cnVjdG9yID09PSBTeW1ib2wgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajsgfTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX25vT3AgPSByZXF1aXJlKCcuL3V0aWxzL25vT3AnKTtcblxudmFyIF9ub09wMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX25vT3ApO1xuXG52YXIgX3JhZkJhdGNoID0gcmVxdWlyZSgnLi9jbGllbnQvcmFmQmF0Y2gnKTtcblxudmFyIF9yYWZCYXRjaDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9yYWZCYXRjaCk7XG5cbnZhciBfY3JlYXRlTm9kZSA9IHJlcXVpcmUoJy4vY3JlYXRlTm9kZScpO1xuXG52YXIgX2NyZWF0ZU5vZGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY3JlYXRlTm9kZSk7XG5cbnZhciBfY29uc29sZSA9IHJlcXVpcmUoJy4vdXRpbHMvY29uc29sZScpO1xuXG52YXIgX2NvbnNvbGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY29uc29sZSk7XG5cbnZhciBfZW1wdHlPYmogPSByZXF1aXJlKCcuL3V0aWxzL2VtcHR5T2JqJyk7XG5cbnZhciBfZW1wdHlPYmoyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZW1wdHlPYmopO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG5mdW5jdGlvbiBtb3VudENvbXBvbmVudCgpIHtcbiAgICB0aGlzLl9pc01vdW50ZWQgPSB0cnVlO1xuICAgIHRoaXMub25Nb3VudCh0aGlzLl9hdHRycyk7XG59XG5cbmZ1bmN0aW9uIHVubW91bnRDb21wb25lbnQoKSB7XG4gICAgdGhpcy5faXNNb3VudGVkID0gZmFsc2U7XG4gICAgdGhpcy5fZG9tUmVmcyA9IG51bGw7XG4gICAgdGhpcy5vblVubW91bnQoKTtcbn1cblxuZnVuY3Rpb24gcGF0Y2hDb21wb25lbnQoYXR0cnMsIGNoaWxkcmVuLCBjdHgsIHBhcmVudE5vZGUpIHtcbiAgICBhdHRycyA9IHRoaXMuX2J1aWxkQXR0cnMoYXR0cnMpO1xuXG4gICAgdmFyIHByZXZSb290Tm9kZSA9IHRoaXMuX3Jvb3ROb2RlLFxuICAgICAgICBwcmV2QXR0cnMgPSB0aGlzLl9hdHRycztcblxuICAgIGlmIChwcmV2QXR0cnMgIT09IGF0dHJzKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzID0gYXR0cnM7XG4gICAgICAgIGlmICh0aGlzLmlzTW91bnRlZCgpKSB7XG4gICAgICAgICAgICB2YXIgaXNVcGRhdGluZyA9IHRoaXMuX2lzVXBkYXRpbmc7XG4gICAgICAgICAgICB0aGlzLl9pc1VwZGF0aW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMub25BdHRyc1JlY2VpdmUoYXR0cnMsIHByZXZBdHRycyk7XG4gICAgICAgICAgICB0aGlzLl9pc1VwZGF0aW5nID0gaXNVcGRhdGluZztcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuX2NoaWxkcmVuID0gY2hpbGRyZW47XG4gICAgdGhpcy5fY3R4ID0gY3R4O1xuXG4gICAgaWYgKHRoaXMuX2lzVXBkYXRpbmcpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBzaG91bGRVcGRhdGUgPSB0aGlzLnNob3VsZFVwZGF0ZShhdHRycywgcHJldkF0dHJzKTtcblxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIHZhciBzaG91bGRVcGRhdGVSZXNUeXBlID0gdHlwZW9mIHNob3VsZFVwZGF0ZSA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2Yoc2hvdWxkVXBkYXRlKTtcbiAgICAgICAgaWYgKHNob3VsZFVwZGF0ZVJlc1R5cGUgIT09ICdib29sZWFuJykge1xuICAgICAgICAgICAgX2NvbnNvbGUyLmRlZmF1bHQud2FybignQ29tcG9uZW50I3Nob3VsZFVwZGF0ZSgpIHNob3VsZCByZXR1cm4gYm9vbGVhbiBpbnN0ZWFkIG9mICcgKyBzaG91bGRVcGRhdGVSZXNUeXBlKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlmIChzaG91bGRVcGRhdGUpIHtcbiAgICAgICAgdGhpcy5fcm9vdE5vZGUgPSB0aGlzLnJlbmRlcigpO1xuICAgICAgICBwcmV2Um9vdE5vZGUucGF0Y2godGhpcy5fcm9vdE5vZGUsIHBhcmVudE5vZGUpO1xuICAgICAgICB0aGlzLmlzTW91bnRlZCgpICYmIHRoaXMub25VcGRhdGUoYXR0cnMsIHByZXZBdHRycyk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzaG91bGRDb21wb25lbnRVcGRhdGUoYXR0cnMsIHByZXZBdHRycykge1xuICAgIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiByZW5kZXJDb21wb25lbnRUb0RvbShwYXJlbnROb2RlKSB7XG4gICAgcmV0dXJuIHRoaXMuX3Jvb3ROb2RlLnJlbmRlclRvRG9tKHBhcmVudE5vZGUpO1xufVxuXG5mdW5jdGlvbiByZW5kZXJDb21wb25lbnRUb1N0cmluZygpIHtcbiAgICByZXR1cm4gdGhpcy5fcm9vdE5vZGUucmVuZGVyVG9TdHJpbmcoKTtcbn1cblxuZnVuY3Rpb24gYWRvcHRDb21wb25lbnREb20oZG9tTm9kZSwgcGFyZW50Tm9kZSkge1xuICAgIHRoaXMuX3Jvb3ROb2RlLmFkb3B0RG9tKGRvbU5vZGUsIHBhcmVudE5vZGUpO1xufVxuXG5mdW5jdGlvbiBnZXRDb21wb25lbnREb21Ob2RlKCkge1xuICAgIHJldHVybiB0aGlzLl9yb290Tm9kZS5nZXREb21Ob2RlKCk7XG59XG5cbmZ1bmN0aW9uIGdldENvbXBvbmVudEF0dHJzKCkge1xuICAgIHJldHVybiB0aGlzLl9hdHRycztcbn1cblxuZnVuY3Rpb24gcmVxdWVzdENoaWxkQ29udGV4dCgpIHtcbiAgICByZXR1cm4gX2VtcHR5T2JqMi5kZWZhdWx0O1xufVxuXG5mdW5jdGlvbiByZW5kZXJDb21wb25lbnQoKSB7XG4gICAgdGhpcy5fZG9tUmVmcyA9IHt9O1xuXG4gICAgdmFyIHJvb3ROb2RlID0gdGhpcy5vblJlbmRlcih0aGlzLl9hdHRycywgdGhpcy5fY2hpbGRyZW4pIHx8ICgwLCBfY3JlYXRlTm9kZTIuZGVmYXVsdCkoJ25vc2NyaXB0Jyk7XG5cbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICBpZiAoKHR5cGVvZiByb290Tm9kZSA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2Yocm9vdE5vZGUpKSAhPT0gJ29iamVjdCcgfHwgQXJyYXkuaXNBcnJheShyb290Tm9kZSkpIHtcbiAgICAgICAgICAgIF9jb25zb2xlMi5kZWZhdWx0LmVycm9yKCdDb21wb25lbnQjb25SZW5kZXIgbXVzdCByZXR1cm4gYSBzaW5nbGUgbm9kZSBvYmplY3Qgb24gdGhlIHRvcCBsZXZlbCcpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGNoaWxkQ3R4ID0gdGhpcy5vbkNoaWxkQ29udGV4dFJlcXVlc3QodGhpcy5fYXR0cnMpO1xuXG4gICAgcm9vdE5vZGUuY3R4KGNoaWxkQ3R4ID09PSBfZW1wdHlPYmoyLmRlZmF1bHQgPyB0aGlzLl9jdHggOiB0aGlzLl9jdHggPT09IF9lbXB0eU9iajIuZGVmYXVsdCA/IGNoaWxkQ3R4IDogX2V4dGVuZHMoe30sIHRoaXMuX2N0eCwgY2hpbGRDdHgpKTtcblxuICAgIHJldHVybiByb290Tm9kZTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlQ29tcG9uZW50KGNiLCBjYkN0eCkge1xuICAgIHZhciBfdGhpcyA9IHRoaXM7XG5cbiAgICBpZiAodGhpcy5faXNVcGRhdGluZykge1xuICAgICAgICBjYiAmJiAoMCwgX3JhZkJhdGNoMi5kZWZhdWx0KShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gY2IuY2FsbChjYkN0eCB8fCBfdGhpcyk7XG4gICAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuX2lzVXBkYXRpbmcgPSB0cnVlO1xuICAgICAgICAoMCwgX3JhZkJhdGNoMi5kZWZhdWx0KShmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBpZiAoX3RoaXMuaXNNb3VudGVkKCkpIHtcbiAgICAgICAgICAgICAgICBfdGhpcy5faXNVcGRhdGluZyA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIF90aGlzLnBhdGNoKF90aGlzLl9hdHRycywgX3RoaXMuX2NoaWxkcmVuKTtcbiAgICAgICAgICAgICAgICBjYiAmJiBjYi5jYWxsKGNiQ3R4IHx8IF90aGlzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBnZXRDb21wb25lbnRSb290Tm9kZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fcm9vdE5vZGU7XG59XG5cbmZ1bmN0aW9uIGlzQ29tcG9uZW50TW91bnRlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5faXNNb3VudGVkO1xufVxuXG5mdW5jdGlvbiBzZXRDb21wb25lbnREb21SZWYocmVmLCBub2RlKSB7XG4gICAgcmV0dXJuIHRoaXMuX2RvbVJlZnNbcmVmXSA9IG5vZGU7XG59XG5cbmZ1bmN0aW9uIGdldENvbXBvbmVudERvbVJlZihyZWYpIHtcbiAgICByZXR1cm4gdGhpcy5fZG9tUmVmc1tyZWZdID8gdGhpcy5fZG9tUmVmc1tyZWZdLmdldERvbU5vZGUoKSA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIGdldENvbXBvbmVudENvbnRleHQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2N0eDtcbn1cblxuZnVuY3Rpb24gZ2V0Q29tcG9uZW50RGVmYXVsdEF0dHJzKCkge1xuICAgIHJldHVybiBfZW1wdHlPYmoyLmRlZmF1bHQ7XG59XG5cbmZ1bmN0aW9uIGJ1aWxkQ29tcG9uZW50QXR0cnMoYXR0cnMpIHtcbiAgICBpZiAodGhpcy5fYXR0cnMgJiYgYXR0cnMgPT09IHRoaXMuX2F0dHJzKSB7XG4gICAgICAgIHJldHVybiBhdHRycztcbiAgICB9XG5cbiAgICB2YXIgY29ucyA9IHRoaXMuY29uc3RydWN0b3IsXG4gICAgICAgIGRlZmF1bHRBdHRycyA9IGNvbnMuX2RlZmF1bHRBdHRycyB8fCAoY29ucy5fZGVmYXVsdEF0dHJzID0gY29ucy5nZXREZWZhdWx0QXR0cnMoKSk7XG5cbiAgICBpZiAoIWF0dHJzKSB7XG4gICAgICAgIHJldHVybiBkZWZhdWx0QXR0cnM7XG4gICAgfVxuXG4gICAgaWYgKGRlZmF1bHRBdHRycyA9PT0gX2VtcHR5T2JqMi5kZWZhdWx0KSB7XG4gICAgICAgIHJldHVybiBhdHRycztcbiAgICB9XG5cbiAgICB2YXIgcmVzID0ge307XG5cbiAgICBmb3IgKHZhciBpIGluIGRlZmF1bHRBdHRycykge1xuICAgICAgICByZXNbaV0gPSBkZWZhdWx0QXR0cnNbaV07XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSBpbiBhdHRycykge1xuICAgICAgICByZXNbaV0gPSBhdHRyc1tpXTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDb21wb25lbnQocHJvcHMsIHN0YXRpY1Byb3BzKSB7XG4gICAgdmFyIHJlcyA9IGZ1bmN0aW9uIHJlcyhhdHRycywgY2hpbGRyZW4sIGN0eCkge1xuICAgICAgICB0aGlzLl9hdHRycyA9IHRoaXMuX2J1aWxkQXR0cnMoYXR0cnMpO1xuICAgICAgICB0aGlzLl9jaGlsZHJlbiA9IGNoaWxkcmVuO1xuICAgICAgICB0aGlzLl9jdHggPSBjdHg7XG4gICAgICAgIHRoaXMuX2RvbVJlZnMgPSBudWxsO1xuICAgICAgICB0aGlzLl9pc01vdW50ZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faXNVcGRhdGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLm9uSW5pdCh0aGlzLl9hdHRycyk7XG4gICAgICAgIHRoaXMuX3Jvb3ROb2RlID0gdGhpcy5yZW5kZXIoKTtcbiAgICB9LFxuICAgICAgICBwdHAgPSB7XG4gICAgICAgIGNvbnN0cnVjdG9yOiByZXMsXG4gICAgICAgIG9uSW5pdDogX25vT3AyLmRlZmF1bHQsXG4gICAgICAgIG1vdW50OiBtb3VudENvbXBvbmVudCxcbiAgICAgICAgdW5tb3VudDogdW5tb3VudENvbXBvbmVudCxcbiAgICAgICAgb25Nb3VudDogX25vT3AyLmRlZmF1bHQsXG4gICAgICAgIG9uVW5tb3VudDogX25vT3AyLmRlZmF1bHQsXG4gICAgICAgIG9uQXR0cnNSZWNlaXZlOiBfbm9PcDIuZGVmYXVsdCxcbiAgICAgICAgc2hvdWxkVXBkYXRlOiBzaG91bGRDb21wb25lbnRVcGRhdGUsXG4gICAgICAgIG9uVXBkYXRlOiBfbm9PcDIuZGVmYXVsdCxcbiAgICAgICAgaXNNb3VudGVkOiBpc0NvbXBvbmVudE1vdW50ZWQsXG4gICAgICAgIHJlbmRlclRvRG9tOiByZW5kZXJDb21wb25lbnRUb0RvbSxcbiAgICAgICAgcmVuZGVyVG9TdHJpbmc6IHJlbmRlckNvbXBvbmVudFRvU3RyaW5nLFxuICAgICAgICBhZG9wdERvbTogYWRvcHRDb21wb25lbnREb20sXG4gICAgICAgIGdldERvbU5vZGU6IGdldENvbXBvbmVudERvbU5vZGUsXG4gICAgICAgIGdldFJvb3ROb2RlOiBnZXRDb21wb25lbnRSb290Tm9kZSxcbiAgICAgICAgcmVuZGVyOiByZW5kZXJDb21wb25lbnQsXG4gICAgICAgIG9uUmVuZGVyOiBfbm9PcDIuZGVmYXVsdCxcbiAgICAgICAgdXBkYXRlOiB1cGRhdGVDb21wb25lbnQsXG4gICAgICAgIHBhdGNoOiBwYXRjaENvbXBvbmVudCxcbiAgICAgICAgZ2V0RG9tUmVmOiBnZXRDb21wb25lbnREb21SZWYsXG4gICAgICAgIHNldERvbVJlZjogc2V0Q29tcG9uZW50RG9tUmVmLFxuICAgICAgICBnZXRBdHRyczogZ2V0Q29tcG9uZW50QXR0cnMsXG4gICAgICAgIG9uQ2hpbGRDb250ZXh0UmVxdWVzdDogcmVxdWVzdENoaWxkQ29udGV4dCxcbiAgICAgICAgZ2V0Q29udGV4dDogZ2V0Q29tcG9uZW50Q29udGV4dCxcbiAgICAgICAgX2J1aWxkQXR0cnM6IGJ1aWxkQ29tcG9uZW50QXR0cnNcbiAgICB9O1xuXG4gICAgZm9yICh2YXIgaSBpbiBwcm9wcykge1xuICAgICAgICBwdHBbaV0gPSBwcm9wc1tpXTtcbiAgICB9XG5cbiAgICByZXMucHJvdG90eXBlID0gcHRwO1xuXG4gICAgcmVzLmdldERlZmF1bHRBdHRycyA9IGdldENvbXBvbmVudERlZmF1bHRBdHRycztcblxuICAgIGZvciAodmFyIGkgaW4gc3RhdGljUHJvcHMpIHtcbiAgICAgICAgcmVzW2ldID0gc3RhdGljUHJvcHNbaV07XG4gICAgfVxuXG4gICAgcmVzLl9fdmlkb21fX2NvbXBvbmVudF9fID0gdHJ1ZTtcblxuICAgIHJldHVybiByZXM7XG59XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGNyZWF0ZUNvbXBvbmVudDsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBfdHlwZW9mID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBTeW1ib2wuaXRlcmF0b3IgPT09IFwic3ltYm9sXCIgPyBmdW5jdGlvbiAob2JqKSB7IHJldHVybiB0eXBlb2Ygb2JqOyB9IDogZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gb2JqICYmIHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiBvYmouY29uc3RydWN0b3IgPT09IFN5bWJvbCA/IFwic3ltYm9sXCIgOiB0eXBlb2Ygb2JqOyB9O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgc3dpdGNoICh0eXBlb2YgdHlwZSA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YodHlwZSkpIHtcbiAgICAgICAgY2FzZSAnc3RyaW5nJzpcbiAgICAgICAgICAgIHJldHVybiBXUkFQUEVSX0NPTVBPTkVOVFNbdHlwZV0gPyBuZXcgX0NvbXBvbmVudE5vZGUyLmRlZmF1bHQoV1JBUFBFUl9DT01QT05FTlRTW3R5cGVdKSA6IG5ldyBfVGFnTm9kZTIuZGVmYXVsdCh0eXBlKTtcblxuICAgICAgICBjYXNlICdmdW5jdGlvbic6XG4gICAgICAgICAgICByZXR1cm4gdHlwZS5fX3ZpZG9tX19jb21wb25lbnRfXyA/IG5ldyBfQ29tcG9uZW50Tm9kZTIuZGVmYXVsdCh0eXBlKSA6IG5ldyBfRnVuY3Rpb25Db21wb25lbnROb2RlMi5kZWZhdWx0KHR5cGUpO1xuXG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgICAgICAgIF9jb25zb2xlMi5kZWZhdWx0LmVycm9yKCdVbnN1cHBvcnRlZCB0eXBlIG9mIG5vZGUnKTtcbiAgICAgICAgICAgIH1cbiAgICB9XG59O1xuXG52YXIgX1RhZ05vZGUgPSByZXF1aXJlKCcuL25vZGVzL1RhZ05vZGUnKTtcblxudmFyIF9UYWdOb2RlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX1RhZ05vZGUpO1xuXG52YXIgX0NvbXBvbmVudE5vZGUgPSByZXF1aXJlKCcuL25vZGVzL0NvbXBvbmVudE5vZGUnKTtcblxudmFyIF9Db21wb25lbnROb2RlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX0NvbXBvbmVudE5vZGUpO1xuXG52YXIgX0Z1bmN0aW9uQ29tcG9uZW50Tm9kZSA9IHJlcXVpcmUoJy4vbm9kZXMvRnVuY3Rpb25Db21wb25lbnROb2RlJyk7XG5cbnZhciBfRnVuY3Rpb25Db21wb25lbnROb2RlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX0Z1bmN0aW9uQ29tcG9uZW50Tm9kZSk7XG5cbnZhciBfSW5wdXQgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvSW5wdXQnKTtcblxudmFyIF9JbnB1dDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9JbnB1dCk7XG5cbnZhciBfVGV4dGFyZWEgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvVGV4dGFyZWEnKTtcblxudmFyIF9UZXh0YXJlYTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9UZXh0YXJlYSk7XG5cbnZhciBfU2VsZWN0ID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL1NlbGVjdCcpO1xuXG52YXIgX1NlbGVjdDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9TZWxlY3QpO1xuXG52YXIgX2NvbnNvbGUgPSByZXF1aXJlKCcuL3V0aWxzL2NvbnNvbGUnKTtcblxudmFyIF9jb25zb2xlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2NvbnNvbGUpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG52YXIgV1JBUFBFUl9DT01QT05FTlRTID0ge1xuICAgIGlucHV0OiBfSW5wdXQyLmRlZmF1bHQsXG4gICAgdGV4dGFyZWE6IF9UZXh0YXJlYTIuZGVmYXVsdCxcbiAgICBzZWxlY3Q6IF9TZWxlY3QyLmRlZmF1bHRcbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLmRlZmF1bHQgPSBDb21wb25lbnROb2RlO1xuXG52YXIgX2VtcHR5T2JqID0gcmVxdWlyZSgnLi4vdXRpbHMvZW1wdHlPYmonKTtcblxudmFyIF9lbXB0eU9iajIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9lbXB0eU9iaik7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7IGRlZmF1bHQ6IG9iaiB9OyB9XG5cbmZ1bmN0aW9uIENvbXBvbmVudE5vZGUoY29tcG9uZW50KSB7XG4gICAgdGhpcy50eXBlID0gQ29tcG9uZW50Tm9kZTtcbiAgICB0aGlzLl9jb21wb25lbnQgPSBjb21wb25lbnQ7XG4gICAgdGhpcy5fa2V5ID0gbnVsbDtcbiAgICB0aGlzLl9hdHRycyA9IG51bGw7XG4gICAgdGhpcy5faW5zdGFuY2UgPSBudWxsO1xuICAgIHRoaXMuX2NoaWxkcmVuID0gbnVsbDtcbiAgICB0aGlzLl9ucyA9IG51bGw7XG4gICAgdGhpcy5fY3R4ID0gX2VtcHR5T2JqMi5kZWZhdWx0O1xufVxuXG5Db21wb25lbnROb2RlLnByb3RvdHlwZSA9IHtcbiAgICBnZXREb21Ob2RlOiBmdW5jdGlvbiBnZXREb21Ob2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5faW5zdGFuY2UuZ2V0RG9tTm9kZSgpO1xuICAgIH0sXG4gICAga2V5OiBmdW5jdGlvbiBrZXkoX2tleSkge1xuICAgICAgICB0aGlzLl9rZXkgPSBfa2V5O1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGF0dHJzOiBmdW5jdGlvbiBhdHRycyhfYXR0cnMpIHtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSBfYXR0cnM7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgY2hpbGRyZW46IGZ1bmN0aW9uIGNoaWxkcmVuKF9jaGlsZHJlbikge1xuICAgICAgICB0aGlzLl9jaGlsZHJlbiA9IF9jaGlsZHJlbjtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBjdHg6IGZ1bmN0aW9uIGN0eChfY3R4KSB7XG4gICAgICAgIHRoaXMuX2N0eCA9IF9jdHg7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgcmVuZGVyVG9Eb206IGZ1bmN0aW9uIHJlbmRlclRvRG9tKHBhcmVudE5vZGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9ucyAmJiBwYXJlbnROb2RlICYmIHBhcmVudE5vZGUuX25zKSB7XG4gICAgICAgICAgICB0aGlzLl9ucyA9IHBhcmVudE5vZGUuX25zO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldEluc3RhbmNlKCkucmVuZGVyVG9Eb20odGhpcyk7XG4gICAgfSxcbiAgICByZW5kZXJUb1N0cmluZzogZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRJbnN0YW5jZSgpLnJlbmRlclRvU3RyaW5nKCk7XG4gICAgfSxcbiAgICBhZG9wdERvbTogZnVuY3Rpb24gYWRvcHREb20oZG9tTm9kZSwgcGFyZW50Tm9kZSkge1xuICAgICAgICB0aGlzLl9nZXRJbnN0YW5jZSgpLmFkb3B0RG9tKGRvbU5vZGUsIHBhcmVudE5vZGUpO1xuICAgIH0sXG4gICAgbW91bnQ6IGZ1bmN0aW9uIG1vdW50KCkge1xuICAgICAgICB0aGlzLl9pbnN0YW5jZS5nZXRSb290Tm9kZSgpLm1vdW50KCk7XG4gICAgICAgIHRoaXMuX2luc3RhbmNlLm1vdW50KCk7XG4gICAgfSxcbiAgICB1bm1vdW50OiBmdW5jdGlvbiB1bm1vdW50KCkge1xuICAgICAgICBpZiAodGhpcy5faW5zdGFuY2UpIHtcbiAgICAgICAgICAgIHRoaXMuX2luc3RhbmNlLmdldFJvb3ROb2RlKCkudW5tb3VudCgpO1xuICAgICAgICAgICAgdGhpcy5faW5zdGFuY2UudW5tb3VudCgpO1xuICAgICAgICAgICAgdGhpcy5faW5zdGFuY2UgPSBudWxsO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBwYXRjaDogZnVuY3Rpb24gcGF0Y2gobm9kZSwgcGFyZW50Tm9kZSkge1xuICAgICAgICBpZiAodGhpcyA9PT0gbm9kZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFub2RlLl9ucyAmJiBwYXJlbnROb2RlICYmIHBhcmVudE5vZGUuX25zKSB7XG4gICAgICAgICAgICBub2RlLl9ucyA9IHBhcmVudE5vZGUuX25zO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGluc3RhbmNlID0gdGhpcy5fZ2V0SW5zdGFuY2UoKTtcblxuICAgICAgICBpZiAodGhpcy50eXBlID09PSBub2RlLnR5cGUpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLl9jb21wb25lbnQgPT09IG5vZGUuX2NvbXBvbmVudCkge1xuICAgICAgICAgICAgICAgIGluc3RhbmNlLnBhdGNoKG5vZGUuX2F0dHJzLCBub2RlLl9jaGlsZHJlbiwgbm9kZS5fY3R4LCBwYXJlbnROb2RlKTtcbiAgICAgICAgICAgICAgICBub2RlLl9pbnN0YW5jZSA9IGluc3RhbmNlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS51bm1vdW50KCk7XG4gICAgICAgICAgICAgICAgdmFyIG5ld0luc3RhbmNlID0gbm9kZS5fZ2V0SW5zdGFuY2UoKTtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5nZXRSb290Tm9kZSgpLnBhdGNoKG5ld0luc3RhbmNlLmdldFJvb3ROb2RlKCksIHBhcmVudE5vZGUpO1xuICAgICAgICAgICAgICAgIG5ld0luc3RhbmNlLm1vdW50KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpbnN0YW5jZS51bm1vdW50KCk7XG4gICAgICAgICAgICBpbnN0YW5jZS5nZXRSb290Tm9kZSgpLnBhdGNoKG5vZGUsIHBhcmVudE5vZGUpO1xuICAgICAgICB9XG4gICAgfSxcbiAgICBfZ2V0SW5zdGFuY2U6IGZ1bmN0aW9uIF9nZXRJbnN0YW5jZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX2luc3RhbmNlIHx8ICh0aGlzLl9pbnN0YW5jZSA9IG5ldyB0aGlzLl9jb21wb25lbnQodGhpcy5fYXR0cnMsIHRoaXMuX2NoaWxkcmVuLCB0aGlzLl9jdHgpKTtcbiAgICB9XG59OyIsIid1c2Ugc3RyaWN0JztcblxudmFyIF90eXBlb2YgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIFN5bWJvbC5pdGVyYXRvciA9PT0gXCJzeW1ib2xcIiA/IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIHR5cGVvZiBvYmo7IH0gOiBmdW5jdGlvbiAob2JqKSB7IHJldHVybiBvYmogJiYgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9iai5jb25zdHJ1Y3RvciA9PT0gU3ltYm9sID8gXCJzeW1ib2xcIiA6IHR5cGVvZiBvYmo7IH07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcbmV4cG9ydHMuZGVmYXVsdCA9IEZ1bmN0aW9uQ29tcG9uZW50Tm9kZTtcblxudmFyIF9UYWdOb2RlID0gcmVxdWlyZSgnLi9UYWdOb2RlJyk7XG5cbnZhciBfVGFnTm9kZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9UYWdOb2RlKTtcblxudmFyIF9lbXB0eU9iaiA9IHJlcXVpcmUoJy4uL3V0aWxzL2VtcHR5T2JqJyk7XG5cbnZhciBfZW1wdHlPYmoyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZW1wdHlPYmopO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG5mdW5jdGlvbiBGdW5jdGlvbkNvbXBvbmVudE5vZGUoY29tcG9uZW50KSB7XG4gICAgdGhpcy50eXBlID0gRnVuY3Rpb25Db21wb25lbnROb2RlO1xuICAgIHRoaXMuX2NvbXBvbmVudCA9IGNvbXBvbmVudDtcbiAgICB0aGlzLl9rZXkgPSBudWxsO1xuICAgIHRoaXMuX2F0dHJzID0gX2VtcHR5T2JqMi5kZWZhdWx0O1xuICAgIHRoaXMuX3Jvb3ROb2RlID0gbnVsbDtcbiAgICB0aGlzLl9jaGlsZHJlbiA9IG51bGw7XG4gICAgdGhpcy5fbnMgPSBudWxsO1xuICAgIHRoaXMuX2N0eCA9IF9lbXB0eU9iajIuZGVmYXVsdDtcbn1cblxuRnVuY3Rpb25Db21wb25lbnROb2RlLnByb3RvdHlwZSA9IHtcbiAgICBnZXREb21Ob2RlOiBmdW5jdGlvbiBnZXREb21Ob2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fcm9vdE5vZGUuZ2V0RG9tTm9kZSgpO1xuICAgIH0sXG4gICAga2V5OiBmdW5jdGlvbiBrZXkoX2tleSkge1xuICAgICAgICB0aGlzLl9rZXkgPSBfa2V5O1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGF0dHJzOiBmdW5jdGlvbiBhdHRycyhfYXR0cnMpIHtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSBfYXR0cnM7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgY2hpbGRyZW46IGZ1bmN0aW9uIGNoaWxkcmVuKF9jaGlsZHJlbikge1xuICAgICAgICB0aGlzLl9jaGlsZHJlbiA9IF9jaGlsZHJlbjtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBjdHg6IGZ1bmN0aW9uIGN0eChfY3R4KSB7XG4gICAgICAgIHRoaXMuX2N0eCA9IF9jdHg7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgcmVuZGVyVG9Eb206IGZ1bmN0aW9uIHJlbmRlclRvRG9tKHBhcmVudE5vZGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9ucyAmJiBwYXJlbnROb2RlICYmIHBhcmVudE5vZGUuX25zKSB7XG4gICAgICAgICAgICB0aGlzLl9ucyA9IHBhcmVudE5vZGUuX25zO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2dldFJvb3ROb2RlKCkucmVuZGVyVG9Eb20odGhpcyk7XG4gICAgfSxcbiAgICByZW5kZXJUb1N0cmluZzogZnVuY3Rpb24gcmVuZGVyVG9TdHJpbmcoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLl9nZXRSb290Tm9kZSgpLnJlbmRlclRvU3RyaW5nKCk7XG4gICAgfSxcbiAgICBhZG9wdERvbTogZnVuY3Rpb24gYWRvcHREb20oZG9tTm9kZSwgcGFyZW50Tm9kZSkge1xuICAgICAgICB0aGlzLl9nZXRSb290Tm9kZSgpLmFkb3B0RG9tKGRvbU5vZGUsIHBhcmVudE5vZGUpO1xuICAgIH0sXG4gICAgbW91bnQ6IGZ1bmN0aW9uIG1vdW50KCkge1xuICAgICAgICB0aGlzLl9nZXRSb290Tm9kZSgpLm1vdW50KCk7XG4gICAgfSxcbiAgICB1bm1vdW50OiBmdW5jdGlvbiB1bm1vdW50KCkge1xuICAgICAgICBpZiAodGhpcy5fcm9vdE5vZGUpIHtcbiAgICAgICAgICAgIHRoaXMuX3Jvb3ROb2RlLnVubW91bnQoKTtcbiAgICAgICAgICAgIHRoaXMuX3Jvb3ROb2RlID0gbnVsbDtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgcGF0Y2g6IGZ1bmN0aW9uIHBhdGNoKG5vZGUsIHBhcmVudE5vZGUpIHtcbiAgICAgICAgaWYgKHRoaXMgPT09IG5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghbm9kZS5fbnMgJiYgcGFyZW50Tm9kZSAmJiBwYXJlbnROb2RlLl9ucykge1xuICAgICAgICAgICAgbm9kZS5fbnMgPSBwYXJlbnROb2RlLl9ucztcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2dldFJvb3ROb2RlKCkucGF0Y2godGhpcy50eXBlID09PSBub2RlLnR5cGUgPyBub2RlLl9nZXRSb290Tm9kZSgpIDogbm9kZSwgcGFyZW50Tm9kZSk7XG4gICAgfSxcbiAgICBfZ2V0Um9vdE5vZGU6IGZ1bmN0aW9uIF9nZXRSb290Tm9kZSgpIHtcbiAgICAgICAgaWYgKHRoaXMuX3Jvb3ROb2RlKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5fcm9vdE5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgcm9vdE5vZGUgPSB0aGlzLl9jb21wb25lbnQodGhpcy5fYXR0cnMsIHRoaXMuX2NoaWxkcmVuLCB0aGlzLl9jdHgpIHx8IG5ldyBfVGFnTm9kZTIuZGVmYXVsdCgnbm9zY3JpcHQnKTtcblxuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgICAgaWYgKCh0eXBlb2Ygcm9vdE5vZGUgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKHJvb3ROb2RlKSkgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkocm9vdE5vZGUpKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignRnVuY3Rpb24gY29tcG9uZW50IG11c3QgcmV0dXJuIGEgc2luZ2xlIG5vZGUgb2JqZWN0IG9uIHRoZSB0b3AgbGV2ZWwnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJvb3ROb2RlLmN0eCh0aGlzLl9jdHgpO1xuXG4gICAgICAgIHJldHVybiB0aGlzLl9yb290Tm9kZSA9IHJvb3ROb2RlO1xuICAgIH1cbn07IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgX3R5cGVvZiA9IHR5cGVvZiBTeW1ib2wgPT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2YgU3ltYm9sLml0ZXJhdG9yID09PSBcInN5bWJvbFwiID8gZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gdHlwZW9mIG9iajsgfSA6IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIG9iaiAmJiB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgb2JqLmNvbnN0cnVjdG9yID09PSBTeW1ib2wgPyBcInN5bWJvbFwiIDogdHlwZW9mIG9iajsgfTtcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0cy5kZWZhdWx0ID0gVGFnTm9kZTtcblxudmFyIF9wYXRjaE9wcyA9IHJlcXVpcmUoJy4uL2NsaWVudC9wYXRjaE9wcycpO1xuXG52YXIgX3BhdGNoT3BzMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX3BhdGNoT3BzKTtcblxudmFyIF9kb21BdHRycyA9IHJlcXVpcmUoJy4uL2NsaWVudC9kb21BdHRycycpO1xuXG52YXIgX2RvbUF0dHJzMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2RvbUF0dHJzKTtcblxudmFyIF9kb21FdmVudE1hbmFnZXIgPSByZXF1aXJlKCcuLi9jbGllbnQvZXZlbnRzL2RvbUV2ZW50TWFuYWdlcicpO1xuXG52YXIgX2F0dHJzVG9FdmVudHMgPSByZXF1aXJlKCcuLi9jbGllbnQvZXZlbnRzL2F0dHJzVG9FdmVudHMnKTtcblxudmFyIF9hdHRyc1RvRXZlbnRzMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2F0dHJzVG9FdmVudHMpO1xuXG52YXIgX2VzY2FwZUh0bWwgPSByZXF1aXJlKCcuLi91dGlscy9lc2NhcGVIdG1sJyk7XG5cbnZhciBfZXNjYXBlSHRtbDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9lc2NhcGVIdG1sKTtcblxudmFyIF9pc0luQXJyYXkgPSByZXF1aXJlKCcuLi91dGlscy9pc0luQXJyYXknKTtcblxudmFyIF9pc0luQXJyYXkyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfaXNJbkFycmF5KTtcblxudmFyIF9jb25zb2xlID0gcmVxdWlyZSgnLi4vdXRpbHMvY29uc29sZScpO1xuXG52YXIgX2NvbnNvbGUyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY29uc29sZSk7XG5cbnZhciBfZW1wdHlPYmogPSByZXF1aXJlKCcuLi91dGlscy9lbXB0eU9iaicpO1xuXG52YXIgX2VtcHR5T2JqMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2VtcHR5T2JqKTtcblxudmFyIF9icm93c2VycyA9IHJlcXVpcmUoJy4uL2NsaWVudC9icm93c2VycycpO1xuXG52YXIgX2NyZWF0ZUVsZW1lbnQgPSByZXF1aXJlKCcuLi9jbGllbnQvdXRpbHMvY3JlYXRlRWxlbWVudCcpO1xuXG52YXIgX2NyZWF0ZUVsZW1lbnQyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfY3JlYXRlRWxlbWVudCk7XG5cbnZhciBfY3JlYXRlRWxlbWVudEJ5SHRtbCA9IHJlcXVpcmUoJy4uL2NsaWVudC91dGlscy9jcmVhdGVFbGVtZW50QnlIdG1sJyk7XG5cbnZhciBfY3JlYXRlRWxlbWVudEJ5SHRtbDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jcmVhdGVFbGVtZW50QnlIdG1sKTtcblxudmFyIF9Db21wb25lbnROb2RlID0gcmVxdWlyZSgnLi9Db21wb25lbnROb2RlJyk7XG5cbnZhciBfQ29tcG9uZW50Tm9kZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9Db21wb25lbnROb2RlKTtcblxudmFyIF9GdW5jdGlvbkNvbXBvbmVudE5vZGUgPSByZXF1aXJlKCcuL0Z1bmN0aW9uQ29tcG9uZW50Tm9kZScpO1xuXG52YXIgX0Z1bmN0aW9uQ29tcG9uZW50Tm9kZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9GdW5jdGlvbkNvbXBvbmVudE5vZGUpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG52YXIgU0hPUlRfVEFHUyA9IHtcbiAgICBhcmVhOiB0cnVlLFxuICAgIGJhc2U6IHRydWUsXG4gICAgYnI6IHRydWUsXG4gICAgY29sOiB0cnVlLFxuICAgIGNvbW1hbmQ6IHRydWUsXG4gICAgZW1iZWQ6IHRydWUsXG4gICAgaHI6IHRydWUsXG4gICAgaW1nOiB0cnVlLFxuICAgIGlucHV0OiB0cnVlLFxuICAgIGtleWdlbjogdHJ1ZSxcbiAgICBsaW5rOiB0cnVlLFxuICAgIG1lbnVpdGVtOiB0cnVlLFxuICAgIG1ldGE6IHRydWUsXG4gICAgcGFyYW06IHRydWUsXG4gICAgc291cmNlOiB0cnVlLFxuICAgIHRyYWNrOiB0cnVlLFxuICAgIHdicjogdHJ1ZVxufSxcbiAgICBVU0VfRE9NX1NUUklOR1MgPSBfYnJvd3NlcnMuaXNUcmlkZW50IHx8IF9icm93c2Vycy5pc0VkZ2U7XG5cbmZ1bmN0aW9uIFRhZ05vZGUodGFnKSB7XG4gICAgdGhpcy50eXBlID0gVGFnTm9kZTtcbiAgICB0aGlzLl90YWcgPSB0YWc7XG4gICAgdGhpcy5fZG9tTm9kZSA9IG51bGw7XG4gICAgdGhpcy5fa2V5ID0gbnVsbDtcbiAgICB0aGlzLl9ucyA9IG51bGw7XG4gICAgdGhpcy5fYXR0cnMgPSBudWxsO1xuICAgIHRoaXMuX2NoaWxkcmVuID0gbnVsbDtcbiAgICB0aGlzLl9lc2NhcGVDaGlsZHJlbiA9IHRydWU7XG4gICAgdGhpcy5fY3R4ID0gX2VtcHR5T2JqMi5kZWZhdWx0O1xufVxuXG5UYWdOb2RlLnByb3RvdHlwZSA9IHtcbiAgICBnZXREb21Ob2RlOiBmdW5jdGlvbiBnZXREb21Ob2RlKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fZG9tTm9kZTtcbiAgICB9LFxuICAgIGtleTogZnVuY3Rpb24ga2V5KF9rZXkpIHtcbiAgICAgICAgdGhpcy5fa2V5ID0gX2tleTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbiAgICBuczogZnVuY3Rpb24gbnMoX25zKSB7XG4gICAgICAgIHRoaXMuX25zID0gX25zO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxuICAgIGF0dHJzOiBmdW5jdGlvbiBhdHRycyhfYXR0cnMpIHtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSBfYXR0cnM7XG5cbiAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgICAgIGNoZWNrQXR0cnMoX2F0dHJzKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgY2hpbGRyZW46IGZ1bmN0aW9uIGNoaWxkcmVuKF9jaGlsZHJlbikge1xuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NoaWxkcmVuICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgX2NvbnNvbGUyLmRlZmF1bHQud2FybignWW91XFwncmUgdHJ5aW5nIHRvIHNldCBjaGlsZHJlbiBvciBodG1sIG1vcmUgdGhhbiBvbmNlIG9yIHBhc3MgYm90aCBjaGlsZHJlbiBhbmQgaHRtbC4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NoaWxkcmVuID0gcHJvY2Vzc0NoaWxkcmVuKF9jaGlsZHJlbik7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgY3R4OiBmdW5jdGlvbiBjdHgoX2N0eCkge1xuICAgICAgICBpZiAoX2N0eCAhPT0gX2VtcHR5T2JqMi5kZWZhdWx0KSB7XG4gICAgICAgICAgICB0aGlzLl9jdHggPSBfY3R4O1xuXG4gICAgICAgICAgICB2YXIgY2hpbGRyZW4gPSB0aGlzLl9jaGlsZHJlbjtcblxuICAgICAgICAgICAgaWYgKGNoaWxkcmVuICYmIHR5cGVvZiBjaGlsZHJlbiAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgICB2YXIgbGVuID0gY2hpbGRyZW4ubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHZhciBpID0gMDtcblxuICAgICAgICAgICAgICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAgICAgIGNoaWxkcmVuW2krK10uY3R4KF9jdHgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgaHRtbDogZnVuY3Rpb24gaHRtbChfaHRtbCkge1xuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICAgICAgaWYgKHRoaXMuX2NoaWxkcmVuICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgX2NvbnNvbGUyLmRlZmF1bHQud2FybignWW91XFwncmUgdHJ5aW5nIHRvIHNldCBjaGlsZHJlbiBvciBodG1sIG1vcmUgdGhhbiBvbmNlIG9yIHBhc3MgYm90aCBjaGlsZHJlbiBhbmQgaHRtbC4nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2NoaWxkcmVuID0gX2h0bWw7XG4gICAgICAgIHRoaXMuX2VzY2FwZUNoaWxkcmVuID0gZmFsc2U7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG4gICAgcmVuZGVyVG9Eb206IGZ1bmN0aW9uIHJlbmRlclRvRG9tKHBhcmVudE5vZGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9ucyAmJiBwYXJlbnROb2RlICYmIHBhcmVudE5vZGUuX25zKSB7XG4gICAgICAgICAgICB0aGlzLl9ucyA9IHBhcmVudE5vZGUuX25zO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNoaWxkcmVuID0gdGhpcy5fY2hpbGRyZW47XG5cbiAgICAgICAgaWYgKFVTRV9ET01fU1RSSU5HUyAmJiBjaGlsZHJlbiAmJiB0eXBlb2YgY2hpbGRyZW4gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB2YXIgX2RvbU5vZGUgPSAoMCwgX2NyZWF0ZUVsZW1lbnRCeUh0bWwyLmRlZmF1bHQpKHRoaXMucmVuZGVyVG9TdHJpbmcoKSwgdGhpcy5fdGFnLCB0aGlzLl9ucyk7XG4gICAgICAgICAgICB0aGlzLmFkb3B0RG9tKF9kb21Ob2RlLCBwYXJlbnROb2RlKTtcbiAgICAgICAgICAgIHJldHVybiBfZG9tTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBkb21Ob2RlID0gKDAsIF9jcmVhdGVFbGVtZW50Mi5kZWZhdWx0KSh0aGlzLl9ucywgdGhpcy5fdGFnKSxcbiAgICAgICAgICAgIGF0dHJzID0gdGhpcy5fYXR0cnM7XG5cbiAgICAgICAgaWYgKGNoaWxkcmVuKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGNoaWxkcmVuID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgIHRoaXMuX2VzY2FwZUNoaWxkcmVuID8gZG9tTm9kZS50ZXh0Q29udGVudCA9IGNoaWxkcmVuIDogZG9tTm9kZS5pbm5lckhUTUwgPSBjaGlsZHJlbjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFyIGkgPSAwO1xuICAgICAgICAgICAgICAgIHZhciBsZW4gPSBjaGlsZHJlbi5sZW5ndGg7XG5cbiAgICAgICAgICAgICAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgICAgICBkb21Ob2RlLmFwcGVuZENoaWxkKGNoaWxkcmVuW2krK10ucmVuZGVyVG9Eb20odGhpcykpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdHRycykge1xuICAgICAgICAgICAgdmFyIG5hbWUgPSB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgdmFsdWUgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gYXR0cnMpIHtcbiAgICAgICAgICAgICAgICAodmFsdWUgPSBhdHRyc1tuYW1lXSkgIT0gbnVsbCAmJiAoX2F0dHJzVG9FdmVudHMyLmRlZmF1bHRbbmFtZV0gPyAoMCwgX2RvbUV2ZW50TWFuYWdlci5hZGRMaXN0ZW5lcikoZG9tTm9kZSwgX2F0dHJzVG9FdmVudHMyLmRlZmF1bHRbbmFtZV0sIHZhbHVlKSA6ICgwLCBfZG9tQXR0cnMyLmRlZmF1bHQpKG5hbWUpLnNldChkb21Ob2RlLCBuYW1lLCB2YWx1ZSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuX2RvbU5vZGUgPSBkb21Ob2RlO1xuICAgIH0sXG4gICAgcmVuZGVyVG9TdHJpbmc6IGZ1bmN0aW9uIHJlbmRlclRvU3RyaW5nKCkge1xuICAgICAgICB2YXIgdGFnID0gdGhpcy5fdGFnLFxuICAgICAgICAgICAgbnMgPSB0aGlzLl9ucyxcbiAgICAgICAgICAgIGF0dHJzID0gdGhpcy5fYXR0cnM7XG5cbiAgICAgICAgdmFyIGNoaWxkcmVuID0gdGhpcy5fY2hpbGRyZW4sXG4gICAgICAgICAgICByZXMgPSAnPCcgKyB0YWc7XG5cbiAgICAgICAgaWYgKG5zKSB7XG4gICAgICAgICAgICByZXMgKz0gJyB4bWxucz1cIicgKyBucyArICdcIic7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXR0cnMpIHtcbiAgICAgICAgICAgIHZhciBuYW1lID0gdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIHZhbHVlID0gdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIGF0dHJIdG1sID0gdW5kZWZpbmVkO1xuICAgICAgICAgICAgZm9yIChuYW1lIGluIGF0dHJzKSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBhdHRyc1tuYW1lXTtcblxuICAgICAgICAgICAgICAgIGlmICh2YWx1ZSAhPSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChuYW1lID09PSAndmFsdWUnKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzd2l0Y2ggKHRhZykge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ3RleHRhcmVhJzpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW4gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjYXNlICdzZWxlY3QnOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmN0eCh7IHZhbHVlOiB2YWx1ZSwgbXVsdGlwbGU6IGF0dHJzLm11bHRpcGxlIH0pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2UgJ29wdGlvbic6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9jdHgubXVsdGlwbGUgPyAoMCwgX2lzSW5BcnJheTIuZGVmYXVsdCkodGhpcy5fY3R4LnZhbHVlLCB2YWx1ZSkgOiB0aGlzLl9jdHgudmFsdWUgPT09IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXMgKz0gJyAnICsgKDAsIF9kb21BdHRyczIuZGVmYXVsdCkoJ3NlbGVjdGVkJykudG9TdHJpbmcoJ3NlbGVjdGVkJywgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGlmICghX2F0dHJzVG9FdmVudHMyLmRlZmF1bHRbbmFtZV0gJiYgKGF0dHJIdG1sID0gKDAsIF9kb21BdHRyczIuZGVmYXVsdCkobmFtZSkudG9TdHJpbmcobmFtZSwgdmFsdWUpKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzICs9ICcgJyArIGF0dHJIdG1sO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKFNIT1JUX1RBR1NbdGFnXSkge1xuICAgICAgICAgICAgcmVzICs9ICcvPic7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXMgKz0gJz4nO1xuXG4gICAgICAgICAgICBpZiAoY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGNoaWxkcmVuID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICAgICAgICByZXMgKz0gdGhpcy5fZXNjYXBlQ2hpbGRyZW4gPyAoMCwgX2VzY2FwZUh0bWwyLmRlZmF1bHQpKGNoaWxkcmVuKSA6IGNoaWxkcmVuO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGxlbiA9IGNoaWxkcmVuLmxlbmd0aDtcblxuICAgICAgICAgICAgICAgICAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzICs9IGNoaWxkcmVuW2krK10ucmVuZGVyVG9TdHJpbmcoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmVzICs9ICc8LycgKyB0YWcgKyAnPic7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH0sXG4gICAgYWRvcHREb206IGZ1bmN0aW9uIGFkb3B0RG9tKGRvbU5vZGUsIHBhcmVudE5vZGUpIHtcbiAgICAgICAgaWYgKCF0aGlzLl9ucyAmJiBwYXJlbnROb2RlICYmIHBhcmVudE5vZGUuX25zKSB7XG4gICAgICAgICAgICB0aGlzLl9ucyA9IHBhcmVudE5vZGUuX25zO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5fZG9tTm9kZSA9IGRvbU5vZGU7XG5cbiAgICAgICAgdmFyIGF0dHJzID0gdGhpcy5fYXR0cnMsXG4gICAgICAgICAgICBjaGlsZHJlbiA9IHRoaXMuX2NoaWxkcmVuO1xuXG4gICAgICAgIGlmIChhdHRycykge1xuICAgICAgICAgICAgdmFyIG5hbWUgPSB1bmRlZmluZWQsXG4gICAgICAgICAgICAgICAgdmFsdWUgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICBmb3IgKG5hbWUgaW4gYXR0cnMpIHtcbiAgICAgICAgICAgICAgICBpZiAoKHZhbHVlID0gYXR0cnNbbmFtZV0pICE9IG51bGwgJiYgX2F0dHJzVG9FdmVudHMyLmRlZmF1bHRbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICAgICAgKDAsIF9kb21FdmVudE1hbmFnZXIuYWRkTGlzdGVuZXIpKGRvbU5vZGUsIF9hdHRyc1RvRXZlbnRzMi5kZWZhdWx0W25hbWVdLCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGNoaWxkcmVuICYmIHR5cGVvZiBjaGlsZHJlbiAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgICAgIHZhciBsZW4gPSBjaGlsZHJlbi5sZW5ndGg7XG5cbiAgICAgICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgICAgICB2YXIgZG9tQ2hpbGRyZW4gPSBkb21Ob2RlLmNoaWxkTm9kZXM7XG4gICAgICAgICAgICAgICAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgY2hpbGRyZW5baV0uYWRvcHREb20oZG9tQ2hpbGRyZW5baV0sIHRoaXMpO1xuICAgICAgICAgICAgICAgICAgICArK2k7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBtb3VudDogZnVuY3Rpb24gbW91bnQoKSB7XG4gICAgICAgIHZhciBjaGlsZHJlbiA9IHRoaXMuX2NoaWxkcmVuO1xuXG4gICAgICAgIGlmIChjaGlsZHJlbiAmJiB0eXBlb2YgY2hpbGRyZW4gIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICB2YXIgaSA9IDA7XG4gICAgICAgICAgICB2YXIgbGVuID0gY2hpbGRyZW4ubGVuZ3RoO1xuXG4gICAgICAgICAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuW2krK10ubW91bnQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG4gICAgdW5tb3VudDogZnVuY3Rpb24gdW5tb3VudCgpIHtcbiAgICAgICAgdmFyIGNoaWxkcmVuID0gdGhpcy5fY2hpbGRyZW47XG5cbiAgICAgICAgaWYgKGNoaWxkcmVuICYmIHR5cGVvZiBjaGlsZHJlbiAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgICAgIHZhciBsZW4gPSBjaGlsZHJlbi5sZW5ndGg7XG5cbiAgICAgICAgICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICAgICAgICAgICAgY2hpbGRyZW5baSsrXS51bm1vdW50KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAoMCwgX2RvbUV2ZW50TWFuYWdlci5yZW1vdmVMaXN0ZW5lcnMpKHRoaXMuX2RvbU5vZGUpO1xuXG4gICAgICAgIHRoaXMuX2RvbU5vZGUgPSBudWxsO1xuICAgIH0sXG4gICAgcGF0Y2g6IGZ1bmN0aW9uIHBhdGNoKG5vZGUsIHBhcmVudE5vZGUpIHtcbiAgICAgICAgaWYgKHRoaXMgPT09IG5vZGUpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghbm9kZS5fbnMgJiYgcGFyZW50Tm9kZSAmJiBwYXJlbnROb2RlLl9ucykge1xuICAgICAgICAgICAgbm9kZS5fbnMgPSBwYXJlbnROb2RlLl9ucztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnR5cGUgIT09IG5vZGUudHlwZSkge1xuICAgICAgICAgICAgc3dpdGNoIChub2RlLnR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlIF9Db21wb25lbnROb2RlMi5kZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICB2YXIgaW5zdGFuY2UgPSBub2RlLl9nZXRJbnN0YW5jZSgpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnBhdGNoKGluc3RhbmNlLmdldFJvb3ROb2RlKCksIHBhcmVudE5vZGUpO1xuICAgICAgICAgICAgICAgICAgICBpbnN0YW5jZS5tb3VudCgpO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgIGNhc2UgX0Z1bmN0aW9uQ29tcG9uZW50Tm9kZTIuZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wYXRjaChub2RlLl9nZXRSb290Tm9kZSgpLCBwYXJlbnROb2RlKTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBfcGF0Y2hPcHMyLmRlZmF1bHQucmVwbGFjZShwYXJlbnROb2RlIHx8IG51bGwsIHRoaXMsIG5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX3RhZyAhPT0gbm9kZS5fdGFnIHx8IHRoaXMuX25zICE9PSBub2RlLl9ucykge1xuICAgICAgICAgICAgX3BhdGNoT3BzMi5kZWZhdWx0LnJlcGxhY2UocGFyZW50Tm9kZSB8fCBudWxsLCB0aGlzLCBub2RlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2RvbU5vZGUgJiYgKG5vZGUuX2RvbU5vZGUgPSB0aGlzLl9kb21Ob2RlKTtcblxuICAgICAgICB0aGlzLl9wYXRjaENoaWxkcmVuKG5vZGUpO1xuICAgICAgICB0aGlzLl9wYXRjaEF0dHJzKG5vZGUpO1xuICAgIH0sXG4gICAgX3BhdGNoQ2hpbGRyZW46IGZ1bmN0aW9uIF9wYXRjaENoaWxkcmVuKG5vZGUpIHtcbiAgICAgICAgdmFyIGNoaWxkcmVuQSA9IHRoaXMuX2NoaWxkcmVuLFxuICAgICAgICAgICAgY2hpbGRyZW5CID0gbm9kZS5fY2hpbGRyZW47XG5cbiAgICAgICAgaWYgKGNoaWxkcmVuQSA9PT0gY2hpbGRyZW5CKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgaXNDaGlsZHJlbkFUZXh0ID0gdHlwZW9mIGNoaWxkcmVuQSA9PT0gJ3N0cmluZycsXG4gICAgICAgICAgICBpc0NoaWxkcmVuQlRleHQgPSB0eXBlb2YgY2hpbGRyZW5CID09PSAnc3RyaW5nJztcblxuICAgICAgICBpZiAoaXNDaGlsZHJlbkJUZXh0KSB7XG4gICAgICAgICAgICBpZiAoaXNDaGlsZHJlbkFUZXh0KSB7XG4gICAgICAgICAgICAgICAgX3BhdGNoT3BzMi5kZWZhdWx0LnVwZGF0ZVRleHQodGhpcywgY2hpbGRyZW5CLCBub2RlLl9lc2NhcGVDaGlsZHJlbik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjaGlsZHJlbkEgJiYgY2hpbGRyZW5BLmxlbmd0aCAmJiBfcGF0Y2hPcHMyLmRlZmF1bHQucmVtb3ZlQ2hpbGRyZW4odGhpcyk7XG4gICAgICAgICAgICBjaGlsZHJlbkIgJiYgX3BhdGNoT3BzMi5kZWZhdWx0LnVwZGF0ZVRleHQodGhpcywgY2hpbGRyZW5CLCBub2RlLl9lc2NhcGVDaGlsZHJlbik7XG5cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghY2hpbGRyZW5CIHx8ICFjaGlsZHJlbkIubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAoY2hpbGRyZW5BKSB7XG4gICAgICAgICAgICAgICAgaXNDaGlsZHJlbkFUZXh0ID8gX3BhdGNoT3BzMi5kZWZhdWx0LnJlbW92ZVRleHQodGhpcykgOiBjaGlsZHJlbkEubGVuZ3RoICYmIF9wYXRjaE9wczIuZGVmYXVsdC5yZW1vdmVDaGlsZHJlbih0aGlzKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzQ2hpbGRyZW5BVGV4dCAmJiBjaGlsZHJlbkEpIHtcbiAgICAgICAgICAgIF9wYXRjaE9wczIuZGVmYXVsdC5yZW1vdmVUZXh0KHRoaXMpO1xuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGNoaWxkcmVuQkxlbiA9IGNoaWxkcmVuQi5sZW5ndGg7XG5cbiAgICAgICAgaWYgKGlzQ2hpbGRyZW5BVGV4dCB8fCAhY2hpbGRyZW5BIHx8ICFjaGlsZHJlbkEubGVuZ3RoKSB7XG4gICAgICAgICAgICB2YXIgaUIgPSAwO1xuICAgICAgICAgICAgd2hpbGUgKGlCIDwgY2hpbGRyZW5CTGVuKSB7XG4gICAgICAgICAgICAgICAgX3BhdGNoT3BzMi5kZWZhdWx0LmFwcGVuZENoaWxkKG5vZGUsIGNoaWxkcmVuQltpQisrXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgY2hpbGRyZW5BTGVuID0gY2hpbGRyZW5BLmxlbmd0aDtcblxuICAgICAgICBpZiAoY2hpbGRyZW5BTGVuID09PSAxICYmIGNoaWxkcmVuQkxlbiA9PT0gMSkge1xuICAgICAgICAgICAgY2hpbGRyZW5BWzBdLnBhdGNoKGNoaWxkcmVuQlswXSwgbm9kZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbGVmdElkeEEgPSAwLFxuICAgICAgICAgICAgcmlnaHRJZHhBID0gY2hpbGRyZW5BTGVuIC0gMSxcbiAgICAgICAgICAgIGxlZnRDaGlsZEEgPSBjaGlsZHJlbkFbbGVmdElkeEFdLFxuICAgICAgICAgICAgbGVmdENoaWxkQUtleSA9IGxlZnRDaGlsZEEuX2tleSxcbiAgICAgICAgICAgIHJpZ2h0Q2hpbGRBID0gY2hpbGRyZW5BW3JpZ2h0SWR4QV0sXG4gICAgICAgICAgICByaWdodENoaWxkQUtleSA9IHJpZ2h0Q2hpbGRBLl9rZXksXG4gICAgICAgICAgICBsZWZ0SWR4QiA9IDAsXG4gICAgICAgICAgICByaWdodElkeEIgPSBjaGlsZHJlbkJMZW4gLSAxLFxuICAgICAgICAgICAgbGVmdENoaWxkQiA9IGNoaWxkcmVuQltsZWZ0SWR4Ql0sXG4gICAgICAgICAgICBsZWZ0Q2hpbGRCS2V5ID0gbGVmdENoaWxkQi5fa2V5LFxuICAgICAgICAgICAgcmlnaHRDaGlsZEIgPSBjaGlsZHJlbkJbcmlnaHRJZHhCXSxcbiAgICAgICAgICAgIHJpZ2h0Q2hpbGRCS2V5ID0gcmlnaHRDaGlsZEIuX2tleSxcbiAgICAgICAgICAgIHVwZGF0ZUxlZnRJZHhBID0gZmFsc2UsXG4gICAgICAgICAgICB1cGRhdGVSaWdodElkeEEgPSBmYWxzZSxcbiAgICAgICAgICAgIHVwZGF0ZUxlZnRJZHhCID0gZmFsc2UsXG4gICAgICAgICAgICB1cGRhdGVSaWdodElkeEIgPSBmYWxzZSxcbiAgICAgICAgICAgIGNoaWxkcmVuQUluZGljZXNUb1NraXAgPSB7fSxcbiAgICAgICAgICAgIGNoaWxkcmVuQUtleXMgPSB1bmRlZmluZWQsXG4gICAgICAgICAgICBmb3VuZEFDaGlsZElkeCA9IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGZvdW5kQUNoaWxkID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIHdoaWxlIChsZWZ0SWR4QSA8PSByaWdodElkeEEgJiYgbGVmdElkeEIgPD0gcmlnaHRJZHhCKSB7XG4gICAgICAgICAgICBpZiAoY2hpbGRyZW5BSW5kaWNlc1RvU2tpcFtsZWZ0SWR4QV0pIHtcbiAgICAgICAgICAgICAgICB1cGRhdGVMZWZ0SWR4QSA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNoaWxkcmVuQUluZGljZXNUb1NraXBbcmlnaHRJZHhBXSkge1xuICAgICAgICAgICAgICAgIHVwZGF0ZVJpZ2h0SWR4QSA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGxlZnRDaGlsZEFLZXkgPT09IGxlZnRDaGlsZEJLZXkpIHtcbiAgICAgICAgICAgICAgICBsZWZ0Q2hpbGRBLnBhdGNoKGxlZnRDaGlsZEIsIG5vZGUpO1xuICAgICAgICAgICAgICAgIHVwZGF0ZUxlZnRJZHhBID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB1cGRhdGVMZWZ0SWR4QiA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJpZ2h0Q2hpbGRBS2V5ID09PSByaWdodENoaWxkQktleSkge1xuICAgICAgICAgICAgICAgIHJpZ2h0Q2hpbGRBLnBhdGNoKHJpZ2h0Q2hpbGRCLCBub2RlKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVSaWdodElkeEEgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHVwZGF0ZVJpZ2h0SWR4QiA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGxlZnRDaGlsZEFLZXkgIT0gbnVsbCAmJiBsZWZ0Q2hpbGRBS2V5ID09PSByaWdodENoaWxkQktleSkge1xuICAgICAgICAgICAgICAgIF9wYXRjaE9wczIuZGVmYXVsdC5tb3ZlQ2hpbGQobm9kZSwgbGVmdENoaWxkQSwgcmlnaHRDaGlsZEEsIHRydWUpO1xuICAgICAgICAgICAgICAgIGxlZnRDaGlsZEEucGF0Y2gocmlnaHRDaGlsZEIsIG5vZGUpO1xuICAgICAgICAgICAgICAgIHVwZGF0ZUxlZnRJZHhBID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB1cGRhdGVSaWdodElkeEIgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChyaWdodENoaWxkQUtleSAhPSBudWxsICYmIHJpZ2h0Q2hpbGRBS2V5ID09PSBsZWZ0Q2hpbGRCS2V5KSB7XG4gICAgICAgICAgICAgICAgX3BhdGNoT3BzMi5kZWZhdWx0Lm1vdmVDaGlsZChub2RlLCByaWdodENoaWxkQSwgbGVmdENoaWxkQSwgZmFsc2UpO1xuICAgICAgICAgICAgICAgIHJpZ2h0Q2hpbGRBLnBhdGNoKGxlZnRDaGlsZEIsIG5vZGUpO1xuICAgICAgICAgICAgICAgIHVwZGF0ZVJpZ2h0SWR4QSA9IHRydWU7XG4gICAgICAgICAgICAgICAgdXBkYXRlTGVmdElkeEIgPSB0cnVlO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChsZWZ0Q2hpbGRBS2V5ICE9IG51bGwgJiYgbGVmdENoaWxkQktleSA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgX3BhdGNoT3BzMi5kZWZhdWx0Lmluc2VydENoaWxkKG5vZGUsIGxlZnRDaGlsZEIsIGxlZnRDaGlsZEEpO1xuICAgICAgICAgICAgICAgIHVwZGF0ZUxlZnRJZHhCID0gdHJ1ZTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAobGVmdENoaWxkQUtleSA9PSBudWxsICYmIGxlZnRDaGlsZEJLZXkgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIF9wYXRjaE9wczIuZGVmYXVsdC5yZW1vdmVDaGlsZChub2RlLCBsZWZ0Q2hpbGRBKTtcbiAgICAgICAgICAgICAgICB1cGRhdGVMZWZ0SWR4QSA9IHRydWU7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNoaWxkcmVuQUtleXMgfHwgKGNoaWxkcmVuQUtleXMgPSBidWlsZEtleXMoY2hpbGRyZW5BLCBsZWZ0SWR4QSwgcmlnaHRJZHhBKSk7XG4gICAgICAgICAgICAgICAgaWYgKChmb3VuZEFDaGlsZElkeCA9IGNoaWxkcmVuQUtleXNbbGVmdENoaWxkQktleV0pICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgZm91bmRBQ2hpbGQgPSBjaGlsZHJlbkFbZm91bmRBQ2hpbGRJZHhdO1xuICAgICAgICAgICAgICAgICAgICBjaGlsZHJlbkFJbmRpY2VzVG9Ta2lwW2ZvdW5kQUNoaWxkSWR4XSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIF9wYXRjaE9wczIuZGVmYXVsdC5tb3ZlQ2hpbGQobm9kZSwgZm91bmRBQ2hpbGQsIGxlZnRDaGlsZEEsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICAgICAgZm91bmRBQ2hpbGQucGF0Y2gobGVmdENoaWxkQiwgbm9kZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgX3BhdGNoT3BzMi5kZWZhdWx0Lmluc2VydENoaWxkKG5vZGUsIGxlZnRDaGlsZEIsIGxlZnRDaGlsZEEpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB1cGRhdGVMZWZ0SWR4QiA9IHRydWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh1cGRhdGVMZWZ0SWR4QSkge1xuICAgICAgICAgICAgICAgIHVwZGF0ZUxlZnRJZHhBID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgaWYgKCsrbGVmdElkeEEgPD0gcmlnaHRJZHhBKSB7XG4gICAgICAgICAgICAgICAgICAgIGxlZnRDaGlsZEEgPSBjaGlsZHJlbkFbbGVmdElkeEFdO1xuICAgICAgICAgICAgICAgICAgICBsZWZ0Q2hpbGRBS2V5ID0gbGVmdENoaWxkQS5fa2V5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHVwZGF0ZVJpZ2h0SWR4QSkge1xuICAgICAgICAgICAgICAgIHVwZGF0ZVJpZ2h0SWR4QSA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmICgtLXJpZ2h0SWR4QSA+PSBsZWZ0SWR4QSkge1xuICAgICAgICAgICAgICAgICAgICByaWdodENoaWxkQSA9IGNoaWxkcmVuQVtyaWdodElkeEFdO1xuICAgICAgICAgICAgICAgICAgICByaWdodENoaWxkQUtleSA9IHJpZ2h0Q2hpbGRBLl9rZXk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodXBkYXRlTGVmdElkeEIpIHtcbiAgICAgICAgICAgICAgICB1cGRhdGVMZWZ0SWR4QiA9IGZhbHNlO1xuICAgICAgICAgICAgICAgIGlmICgrK2xlZnRJZHhCIDw9IHJpZ2h0SWR4Qikge1xuICAgICAgICAgICAgICAgICAgICBsZWZ0Q2hpbGRCID0gY2hpbGRyZW5CW2xlZnRJZHhCXTtcbiAgICAgICAgICAgICAgICAgICAgbGVmdENoaWxkQktleSA9IGxlZnRDaGlsZEIuX2tleTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh1cGRhdGVSaWdodElkeEIpIHtcbiAgICAgICAgICAgICAgICB1cGRhdGVSaWdodElkeEIgPSBmYWxzZTtcbiAgICAgICAgICAgICAgICBpZiAoLS1yaWdodElkeEIgPj0gbGVmdElkeEIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmlnaHRDaGlsZEIgPSBjaGlsZHJlbkJbcmlnaHRJZHhCXTtcbiAgICAgICAgICAgICAgICAgICAgcmlnaHRDaGlsZEJLZXkgPSByaWdodENoaWxkQi5fa2V5O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHdoaWxlIChsZWZ0SWR4QSA8PSByaWdodElkeEEpIHtcbiAgICAgICAgICAgIGlmICghY2hpbGRyZW5BSW5kaWNlc1RvU2tpcFtsZWZ0SWR4QV0pIHtcbiAgICAgICAgICAgICAgICBfcGF0Y2hPcHMyLmRlZmF1bHQucmVtb3ZlQ2hpbGQobm9kZSwgY2hpbGRyZW5BW2xlZnRJZHhBXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICArK2xlZnRJZHhBO1xuICAgICAgICB9XG5cbiAgICAgICAgd2hpbGUgKGxlZnRJZHhCIDw9IHJpZ2h0SWR4Qikge1xuICAgICAgICAgICAgcmlnaHRJZHhCIDwgY2hpbGRyZW5CTGVuIC0gMSA/IF9wYXRjaE9wczIuZGVmYXVsdC5pbnNlcnRDaGlsZChub2RlLCBjaGlsZHJlbkJbbGVmdElkeEJdLCBjaGlsZHJlbkJbcmlnaHRJZHhCICsgMV0pIDogX3BhdGNoT3BzMi5kZWZhdWx0LmFwcGVuZENoaWxkKG5vZGUsIGNoaWxkcmVuQltsZWZ0SWR4Ql0pO1xuICAgICAgICAgICAgKytsZWZ0SWR4QjtcbiAgICAgICAgfVxuICAgIH0sXG4gICAgX3BhdGNoQXR0cnM6IGZ1bmN0aW9uIF9wYXRjaEF0dHJzKG5vZGUpIHtcbiAgICAgICAgdmFyIGF0dHJzQSA9IHRoaXMuX2F0dHJzLFxuICAgICAgICAgICAgYXR0cnNCID0gbm9kZS5fYXR0cnM7XG5cbiAgICAgICAgaWYgKGF0dHJzQSA9PT0gYXR0cnNCKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgYXR0ck5hbWUgPSB1bmRlZmluZWQsXG4gICAgICAgICAgICBhdHRyQVZhbCA9IHVuZGVmaW5lZCxcbiAgICAgICAgICAgIGF0dHJCVmFsID0gdW5kZWZpbmVkLFxuICAgICAgICAgICAgaXNBdHRyQVZhbEFycmF5ID0gdW5kZWZpbmVkLFxuICAgICAgICAgICAgaXNBdHRyQlZhbEFycmF5ID0gdW5kZWZpbmVkO1xuXG4gICAgICAgIGlmIChhdHRyc0IpIHtcbiAgICAgICAgICAgIGZvciAoYXR0ck5hbWUgaW4gYXR0cnNCKSB7XG4gICAgICAgICAgICAgICAgYXR0ckJWYWwgPSBhdHRyc0JbYXR0ck5hbWVdO1xuICAgICAgICAgICAgICAgIGlmICghYXR0cnNBIHx8IChhdHRyQVZhbCA9IGF0dHJzQVthdHRyTmFtZV0pID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGF0dHJCVmFsICE9IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIF9wYXRjaE9wczIuZGVmYXVsdC51cGRhdGVBdHRyKHRoaXMsIGF0dHJOYW1lLCBhdHRyQlZhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGF0dHJCVmFsID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgX3BhdGNoT3BzMi5kZWZhdWx0LnJlbW92ZUF0dHIodGhpcywgYXR0ck5hbWUpO1xuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoKHR5cGVvZiBhdHRyQlZhbCA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YoYXR0ckJWYWwpKSA9PT0gJ29iamVjdCcgJiYgKHR5cGVvZiBhdHRyQVZhbCA9PT0gJ3VuZGVmaW5lZCcgPyAndW5kZWZpbmVkJyA6IF90eXBlb2YoYXR0ckFWYWwpKSA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICAgICAgaXNBdHRyQlZhbEFycmF5ID0gQXJyYXkuaXNBcnJheShhdHRyQlZhbCk7XG4gICAgICAgICAgICAgICAgICAgIGlzQXR0ckFWYWxBcnJheSA9IEFycmF5LmlzQXJyYXkoYXR0ckFWYWwpO1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNBdHRyQlZhbEFycmF5IHx8IGlzQXR0ckFWYWxBcnJheSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzQXR0ckJWYWxBcnJheSAmJiBpc0F0dHJBVmFsQXJyYXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9wYXRjaEF0dHJBcnIoYXR0ck5hbWUsIGF0dHJBVmFsLCBhdHRyQlZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIF9wYXRjaE9wczIuZGVmYXVsdC51cGRhdGVBdHRyKHRoaXMsIGF0dHJOYW1lLCBhdHRyQlZhbCk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9wYXRjaEF0dHJPYmooYXR0ck5hbWUsIGF0dHJBVmFsLCBhdHRyQlZhbCk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGF0dHJBVmFsICE9PSBhdHRyQlZhbCkge1xuICAgICAgICAgICAgICAgICAgICBfcGF0Y2hPcHMyLmRlZmF1bHQudXBkYXRlQXR0cih0aGlzLCBhdHRyTmFtZSwgYXR0ckJWYWwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdHRyc0EpIHtcbiAgICAgICAgICAgIGZvciAoYXR0ck5hbWUgaW4gYXR0cnNBKSB7XG4gICAgICAgICAgICAgICAgaWYgKCghYXR0cnNCIHx8ICEoYXR0ck5hbWUgaW4gYXR0cnNCKSkgJiYgKGF0dHJBVmFsID0gYXR0cnNBW2F0dHJOYW1lXSkgIT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBfcGF0Y2hPcHMyLmRlZmF1bHQucmVtb3ZlQXR0cih0aGlzLCBhdHRyTmFtZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBfcGF0Y2hBdHRyQXJyOiBmdW5jdGlvbiBfcGF0Y2hBdHRyQXJyKGF0dHJOYW1lLCBhcnJBLCBhcnJCKSB7XG4gICAgICAgIGlmIChhcnJBID09PSBhcnJCKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgbGVuQSA9IGFyckEubGVuZ3RoO1xuICAgICAgICB2YXIgaGFzRGlmZiA9IGZhbHNlO1xuXG4gICAgICAgIGlmIChsZW5BICE9PSBhcnJCLmxlbmd0aCkge1xuICAgICAgICAgICAgaGFzRGlmZiA9IHRydWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB2YXIgaSA9IDA7XG4gICAgICAgICAgICB3aGlsZSAoIWhhc0RpZmYgJiYgaSA8IGxlbkEpIHtcbiAgICAgICAgICAgICAgICBpZiAoYXJyQVtpXSAhPSBhcnJCW2ldKSB7XG4gICAgICAgICAgICAgICAgICAgIGhhc0RpZmYgPSB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICArK2k7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBoYXNEaWZmICYmIF9wYXRjaE9wczIuZGVmYXVsdC51cGRhdGVBdHRyKHRoaXMsIGF0dHJOYW1lLCBhcnJCKTtcbiAgICB9LFxuICAgIF9wYXRjaEF0dHJPYmo6IGZ1bmN0aW9uIF9wYXRjaEF0dHJPYmooYXR0ck5hbWUsIG9iakEsIG9iakIpIHtcbiAgICAgICAgaWYgKG9iakEgPT09IG9iakIpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBoYXNEaWZmID0gZmFsc2UsXG4gICAgICAgICAgICBkaWZmT2JqID0ge307XG5cbiAgICAgICAgZm9yICh2YXIgaSBpbiBvYmpCKSB7XG4gICAgICAgICAgICBpZiAob2JqQVtpXSAhPSBvYmpCW2ldKSB7XG4gICAgICAgICAgICAgICAgaGFzRGlmZiA9IHRydWU7XG4gICAgICAgICAgICAgICAgZGlmZk9ialtpXSA9IG9iakJbaV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKHZhciBpIGluIG9iakEpIHtcbiAgICAgICAgICAgIGlmIChvYmpBW2ldICE9IG51bGwgJiYgIShpIGluIG9iakIpKSB7XG4gICAgICAgICAgICAgICAgaGFzRGlmZiA9IHRydWU7XG4gICAgICAgICAgICAgICAgZGlmZk9ialtpXSA9IG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBoYXNEaWZmICYmIF9wYXRjaE9wczIuZGVmYXVsdC51cGRhdGVBdHRyKHRoaXMsIGF0dHJOYW1lLCBkaWZmT2JqKTtcbiAgICB9XG59O1xuXG5mdW5jdGlvbiBwcm9jZXNzQ2hpbGRyZW4oY2hpbGRyZW4pIHtcbiAgICBpZiAoY2hpbGRyZW4gPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgdHlwZU9mQ2hpbGRyZW4gPSB0eXBlb2YgY2hpbGRyZW4gPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKGNoaWxkcmVuKTtcblxuICAgIGlmICh0eXBlT2ZDaGlsZHJlbiA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgdmFyIHJlcyA9IEFycmF5LmlzQXJyYXkoY2hpbGRyZW4pID8gY2hpbGRyZW4gOiBbY2hpbGRyZW5dO1xuXG4gICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgICBjaGVja0NoaWxkcmVuKHJlcyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gcmVzO1xuICAgIH1cblxuICAgIHJldHVybiB0eXBlT2ZDaGlsZHJlbiA9PT0gJ3N0cmluZycgPyBjaGlsZHJlbiA6IGNoaWxkcmVuLnRvU3RyaW5nKCk7XG59XG5cbmZ1bmN0aW9uIGNoZWNrQ2hpbGRyZW4oY2hpbGRyZW4pIHtcbiAgICB2YXIga2V5cyA9IHt9LFxuICAgICAgICBsZW4gPSBjaGlsZHJlbi5sZW5ndGg7XG5cbiAgICB2YXIgaSA9IDAsXG4gICAgICAgIGNoaWxkID0gdW5kZWZpbmVkO1xuXG4gICAgd2hpbGUgKGkgPCBsZW4pIHtcbiAgICAgICAgY2hpbGQgPSBjaGlsZHJlbltpKytdO1xuXG4gICAgICAgIGlmICgodHlwZW9mIGNoaWxkID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihjaGlsZCkpICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgX2NvbnNvbGUyLmRlZmF1bHQuZXJyb3IoJ1lvdSBtdXN0blxcJ3QgdXNlIHNpbXBsZSBjaGlsZCBpbiBjYXNlIG9mIG11bHRpcGxlIGNoaWxkcmVuLicpO1xuICAgICAgICB9IGVsc2UgaWYgKGNoaWxkLl9rZXkgIT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGNoaWxkLl9rZXkgaW4ga2V5cykge1xuICAgICAgICAgICAgICAgIF9jb25zb2xlMi5kZWZhdWx0LmVycm9yKCdDaGlsZHJlbnNcXCcga2V5cyBtdXN0IGJlIHVuaXF1ZSBhY3Jvc3MgdGhlIGNoaWxkcmVuLiBGb3VuZCBkdXBsaWNhdGUgb2YgXCInICsgY2hpbGQuX2tleSArICdcIiBrZXkuJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGtleXNbY2hpbGQuX2tleV0gPSB0cnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBidWlsZEtleXMoY2hpbGRyZW4sIGlkeEZyb20sIGlkeFRvKSB7XG4gICAgdmFyIHJlcyA9IHt9LFxuICAgICAgICBjaGlsZCA9IHVuZGVmaW5lZDtcblxuICAgIHdoaWxlIChpZHhGcm9tIDwgaWR4VG8pIHtcbiAgICAgICAgY2hpbGQgPSBjaGlsZHJlbltpZHhGcm9tXTtcbiAgICAgICAgY2hpbGQuX2tleSAhPSBudWxsICYmIChyZXNbY2hpbGQuX2tleV0gPSBpZHhGcm9tKTtcbiAgICAgICAgKytpZHhGcm9tO1xuICAgIH1cblxuICAgIHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIGNoZWNrQXR0cnMoYXR0cnMpIHtcbiAgICBmb3IgKHZhciBuYW1lIGluIGF0dHJzKSB7XG4gICAgICAgIGlmIChuYW1lLnN1YnN0cigwLCAyKSA9PT0gJ29uJyAmJiAhX2F0dHJzVG9FdmVudHMyLmRlZmF1bHRbbmFtZV0pIHtcbiAgICAgICAgICAgIF9jb25zb2xlMi5kZWZhdWx0LmVycm9yKCdZb3VcXCdyZSB0cnlpbmcgdG8gYWRkIHVuc3VwcG9ydGVkIGV2ZW50IGxpc3RlbmVyIFwiJyArIG5hbWUgKyAnXCIuJyk7XG4gICAgICAgIH1cbiAgICB9XG59IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGZ1bmN0aW9uICh0cmVlKSB7XG4gIHJldHVybiB0cmVlLnJlbmRlclRvU3RyaW5nKCk7XG59OyIsIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsIFwiX19lc01vZHVsZVwiLCB7XG4gICAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX25vT3AgPSByZXF1aXJlKCcuL25vT3AnKTtcblxudmFyIF9ub09wMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX25vT3ApO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG52YXIgZ2xvYmFsQ29uc29sZSA9IGdsb2JhbC5jb25zb2xlLFxuICAgIGNvbnNvbGUgPSB7fSxcbiAgICBQUkVGSVhFUyA9IHtcbiAgICBsb2c6ICcnLFxuICAgIGluZm86ICcnLFxuICAgIHdhcm46ICdXYXJuaW5nIScsXG4gICAgZXJyb3I6ICdFcnJvciEnXG59O1xuXG5bJ2xvZycsICdpbmZvJywgJ3dhcm4nLCAnZXJyb3InXS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgY29uc29sZVtuYW1lXSA9IGdsb2JhbENvbnNvbGUgPyBnbG9iYWxDb25zb2xlW25hbWVdID8gZnVuY3Rpb24gKGFyZzEsIGFyZzIsIGFyZzMsIGFyZzQsIGFyZzUpIHtcbiAgICAgICAgLy8gSUU5OiBjb25zb2xlIG1ldGhvZHMgYXJlbid0IGZ1bmN0aW9uc1xuICAgICAgICB2YXIgYXJnMCA9IFBSRUZJWEVTW25hbWVdO1xuICAgICAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgICAgICBnbG9iYWxDb25zb2xlW25hbWVdKGFyZzAsIGFyZzEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICAgICAgZ2xvYmFsQ29uc29sZVtuYW1lXShhcmcwLCBhcmcxLCBhcmcyKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAzOlxuICAgICAgICAgICAgICAgIGdsb2JhbENvbnNvbGVbbmFtZV0oYXJnMCwgYXJnMSwgYXJnMiwgYXJnMyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgNDpcbiAgICAgICAgICAgICAgICBnbG9iYWxDb25zb2xlW25hbWVdKGFyZzAsIGFyZzEsIGFyZzIsIGFyZzMsIGFyZzQpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIDU6XG4gICAgICAgICAgICAgICAgZ2xvYmFsQ29uc29sZVtuYW1lXShhcmcwLCBhcmcxLCBhcmcyLCBhcmczLCBhcmc0LCBhcmc1KTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgIH0gOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGdsb2JhbENvbnNvbGUubG9nLmFwcGx5KGdsb2JhbENvbnNvbGUsIGFyZ3VtZW50cyk7XG4gICAgfSA6IF9ub09wMi5kZWZhdWx0O1xufSk7XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGNvbnNvbGU7IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xudmFyIERBU0hFUklaRV9SRSA9IC8oW15BLVpdKykoW0EtWl0pL2c7XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGZ1bmN0aW9uIChzdHIpIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKERBU0hFUklaRV9SRSwgJyQxLSQyJykudG9Mb3dlckNhc2UoKTtcbn07IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLmRlZmF1bHQgPSB7fTsiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKHN0cikge1xuICAgIHJldHVybiAoc3RyICsgJycpLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvXCIvZywgJyZxdW90OycpO1xufTsiLCIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKHN0cikge1xuICAgIHJldHVybiAoc3RyICsgJycpLnJlcGxhY2UoLyYvZywgJyZhbXA7JykucmVwbGFjZSgvPC9nLCAnJmx0OycpLnJlcGxhY2UoLz4vZywgJyZndDsnKTtcbn07IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKGFyciwgaXRlbSkge1xuICAgIHZhciBsZW4gPSBhcnIubGVuZ3RoO1xuICAgIHZhciBpID0gMDtcblxuICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICAgIGlmIChhcnJbaSsrXSA9PSBpdGVtKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn07IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5cbmV4cG9ydHMuZGVmYXVsdCA9IGZ1bmN0aW9uICgpIHt9OyIsIid1c2Ugc3RyaWN0JztcblxudmFyIF90eXBlb2YgPSB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgdHlwZW9mIFN5bWJvbC5pdGVyYXRvciA9PT0gXCJzeW1ib2xcIiA/IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIHR5cGVvZiBvYmo7IH0gOiBmdW5jdGlvbiAob2JqKSB7IHJldHVybiBvYmogJiYgdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9iai5jb25zdHJ1Y3RvciA9PT0gU3ltYm9sID8gXCJzeW1ib2xcIiA6IHR5cGVvZiBvYmo7IH07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBcIl9fZXNNb2R1bGVcIiwge1xuICAgIHZhbHVlOiB0cnVlXG59KTtcblxuZXhwb3J0cy5kZWZhdWx0ID0gZnVuY3Rpb24gKGNoaWxkcmVuKSB7XG4gICAgdmFyIHJlcyA9IG5vcm1hbGl6ZUNoaWxkcmVuKGNoaWxkcmVuKTtcblxuICAgIGlmIChyZXMgIT09IG51bGwgJiYgKHR5cGVvZiByZXMgPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKHJlcykpID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheShyZXMpKSB7XG4gICAgICAgIHJlcyA9IFtyZXNdO1xuICAgIH1cblxuICAgIHJldHVybiByZXM7XG59O1xuXG52YXIgX2NyZWF0ZU5vZGUgPSByZXF1aXJlKCcuLi9jcmVhdGVOb2RlJyk7XG5cbnZhciBfY3JlYXRlTm9kZTIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9jcmVhdGVOb2RlKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxuZnVuY3Rpb24gbm9ybWFsaXplQ2hpbGRyZW4oY2hpbGRyZW4pIHtcbiAgICBpZiAoY2hpbGRyZW4gPT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgdHlwZU9mQ2hpbGRyZW4gPSB0eXBlb2YgY2hpbGRyZW4gPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKGNoaWxkcmVuKTtcbiAgICBpZiAodHlwZU9mQ2hpbGRyZW4gIT09ICdvYmplY3QnKSB7XG4gICAgICAgIHJldHVybiB0eXBlT2ZDaGlsZHJlbiA9PT0gJ3N0cmluZycgPyBjaGlsZHJlbiA6IGNoaWxkcmVuLnRvU3RyaW5nKCk7XG4gICAgfVxuXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KGNoaWxkcmVuKSkge1xuICAgICAgICByZXR1cm4gY2hpbGRyZW47XG4gICAgfVxuXG4gICAgaWYgKCFjaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgdmFyIHJlcyA9IGNoaWxkcmVuLFxuICAgICAgICBpID0gMCxcbiAgICAgICAgbGVuID0gY2hpbGRyZW4ubGVuZ3RoLFxuICAgICAgICBhbGxTa2lwcGVkID0gdHJ1ZSxcbiAgICAgICAgY2hpbGQgPSB1bmRlZmluZWQsXG4gICAgICAgIGlzQ2hpbGRPYmplY3QgPSB1bmRlZmluZWQ7XG5cbiAgICB3aGlsZSAoaSA8IGxlbikge1xuICAgICAgICBjaGlsZCA9IG5vcm1hbGl6ZUNoaWxkcmVuKGNoaWxkcmVuW2ldKTtcbiAgICAgICAgaWYgKGNoaWxkID09PSBudWxsKSB7XG4gICAgICAgICAgICBpZiAocmVzICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgaWYgKGFsbFNraXBwZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzID0gbnVsbDtcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHJlcyA9PT0gY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgcmVzID0gY2hpbGRyZW4uc2xpY2UoMCwgaSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHJlcyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIHJlcyA9IGNoaWxkO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGNoaWxkKSkge1xuICAgICAgICAgICAgICAgIHJlcyA9IGFsbFNraXBwZWQgPyBjaGlsZCA6IChyZXMgPT09IGNoaWxkcmVuID8gcmVzLnNsaWNlKDAsIGkpIDogQXJyYXkuaXNBcnJheShyZXMpID8gcmVzIDogW3Jlc10pLmNvbmNhdChjaGlsZCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlzQ2hpbGRPYmplY3QgPSAodHlwZW9mIGNoaWxkID09PSAndW5kZWZpbmVkJyA/ICd1bmRlZmluZWQnIDogX3R5cGVvZihjaGlsZCkpID09PSAnb2JqZWN0JztcblxuICAgICAgICAgICAgICAgIGlmIChpc0NoaWxkT2JqZWN0ICYmIGNoaWxkcmVuW2ldID09PSBjaGlsZCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAocmVzICE9PSBjaGlsZHJlbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzID0gam9pbihyZXMsIGNoaWxkKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChyZXMgPT09IGNoaWxkcmVuKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYWxsU2tpcHBlZCAmJiBpc0NoaWxkT2JqZWN0KSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzID0gY2hpbGQ7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKytpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgICAgICByZXMgPSByZXMuc2xpY2UoMCwgaSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICByZXMgPSBqb2luKHJlcywgY2hpbGQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgYWxsU2tpcHBlZCA9IGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgKytpO1xuICAgIH1cblxuICAgIHJldHVybiByZXM7XG59XG5cbmZ1bmN0aW9uIHRvTm9kZShvYmopIHtcbiAgICByZXR1cm4gKHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnID8gJ3VuZGVmaW5lZCcgOiBfdHlwZW9mKG9iaikpID09PSAnb2JqZWN0JyA/IG9iaiA6ICgwLCBfY3JlYXRlTm9kZTIuZGVmYXVsdCkoJ3NwYW4nKS5jaGlsZHJlbihvYmopO1xufVxuXG5mdW5jdGlvbiBqb2luKG9iakEsIG9iakIpIHtcbiAgICBpZiAoQXJyYXkuaXNBcnJheShvYmpBKSkge1xuICAgICAgICBvYmpBLnB1c2godG9Ob2RlKG9iakIpKTtcbiAgICAgICAgcmV0dXJuIG9iakE7XG4gICAgfVxuXG4gICAgcmV0dXJuIFt0b05vZGUob2JqQSksIHRvTm9kZShvYmpCKV07XG59IiwiJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgICB2YWx1ZTogdHJ1ZVxufSk7XG5leHBvcnRzLkNvbXBvbmVudCA9IGV4cG9ydHMubm9ybWFsaXplQ2hpbGRyZW4gPSBleHBvcnRzLnJlbmRlclRvU3RyaW5nID0gZXhwb3J0cy5jcmVhdGVDb21wb25lbnQgPSBleHBvcnRzLm5vZGUgPSBleHBvcnRzLnVubW91bnRGcm9tRG9tU3luYyA9IGV4cG9ydHMudW5tb3VudEZyb21Eb20gPSBleHBvcnRzLm1vdW50VG9Eb21TeW5jID0gZXhwb3J0cy5tb3VudFRvRG9tID0gdW5kZWZpbmVkO1xuXG52YXIgX21vdW50ZXIgPSByZXF1aXJlKCcuL2NsaWVudC9tb3VudGVyJyk7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnbW91bnRUb0RvbScsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICByZXR1cm4gX21vdW50ZXIubW91bnRUb0RvbTtcbiAgICB9XG59KTtcbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnbW91bnRUb0RvbVN5bmMnLCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAgICAgcmV0dXJuIF9tb3VudGVyLm1vdW50VG9Eb21TeW5jO1xuICAgIH1cbn0pO1xuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICd1bm1vdW50RnJvbURvbScsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICByZXR1cm4gX21vdW50ZXIudW5tb3VudEZyb21Eb207XG4gICAgfVxufSk7XG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ3VubW91bnRGcm9tRG9tU3luYycsIHtcbiAgICBlbnVtZXJhYmxlOiB0cnVlLFxuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgICByZXR1cm4gX21vdW50ZXIudW5tb3VudEZyb21Eb21TeW5jO1xuICAgIH1cbn0pO1xuXG52YXIgX2NyZWF0ZU5vZGUgPSByZXF1aXJlKCcuL2NyZWF0ZU5vZGUnKTtcblxudmFyIF9jcmVhdGVOb2RlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2NyZWF0ZU5vZGUpO1xuXG52YXIgX2NyZWF0ZUNvbXBvbmVudCA9IHJlcXVpcmUoJy4vY3JlYXRlQ29tcG9uZW50Jyk7XG5cbnZhciBfY3JlYXRlQ29tcG9uZW50MiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2NyZWF0ZUNvbXBvbmVudCk7XG5cbnZhciBfcmVuZGVyVG9TdHJpbmcgPSByZXF1aXJlKCcuL3JlbmRlclRvU3RyaW5nJyk7XG5cbnZhciBfcmVuZGVyVG9TdHJpbmcyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfcmVuZGVyVG9TdHJpbmcpO1xuXG52YXIgX25vcm1hbGl6ZUNoaWxkcmVuID0gcmVxdWlyZSgnLi91dGlscy9ub3JtYWxpemVDaGlsZHJlbicpO1xuXG52YXIgX25vcm1hbGl6ZUNoaWxkcmVuMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX25vcm1hbGl6ZUNoaWxkcmVuKTtcblxudmFyIF9Db21wb25lbnQgPSByZXF1aXJlKCcuL0NvbXBvbmVudCcpO1xuXG52YXIgX0NvbXBvbmVudDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9Db21wb25lbnQpO1xuXG52YXIgX2NvbnNvbGUgPSByZXF1aXJlKCcuL3V0aWxzL2NvbnNvbGUnKTtcblxudmFyIF9jb25zb2xlMiA9IF9pbnRlcm9wUmVxdWlyZURlZmF1bHQoX2NvbnNvbGUpO1xuXG5mdW5jdGlvbiBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyBkZWZhdWx0OiBvYmogfTsgfVxuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgIF9jb25zb2xlMi5kZWZhdWx0LmluZm8oJ1lvdVxcJ3JlIHVzaW5nIGRldiB2ZXJzaW9uIG9mIFZpZG9tJyk7XG59XG5cbi8vIFRPRE86IHRha2UgYmFjayBhZnRlciBodHRwczovL3BoYWJyaWNhdG9yLmJhYmVsanMuaW8vVDY3ODZcbi8vIGV4cG9ydCAqIGZyb20gJy4vY2xpZW50L21vdW50ZXInO1xuZXhwb3J0cy5ub2RlID0gX2NyZWF0ZU5vZGUyLmRlZmF1bHQ7XG5leHBvcnRzLmNyZWF0ZUNvbXBvbmVudCA9IF9jcmVhdGVDb21wb25lbnQyLmRlZmF1bHQ7XG5leHBvcnRzLnJlbmRlclRvU3RyaW5nID0gX3JlbmRlclRvU3RyaW5nMi5kZWZhdWx0O1xuZXhwb3J0cy5ub3JtYWxpemVDaGlsZHJlbiA9IF9ub3JtYWxpemVDaGlsZHJlbjIuZGVmYXVsdDtcbmV4cG9ydHMuQ29tcG9uZW50ID0gX0NvbXBvbmVudDIuZGVmYXVsdDsiLCJpbXBvcnQgQ2xpcGJvYXJkIGZyb20gXCJjbGlwYm9hcmRcIlxuaW1wb3J0IHsgbm9kZSAsIENvbXBvbmVudCwgbW91bnRUb0RvbSB9IGZyb20gJ3ZpZG9tL2xpYi92aWRvbSc7XG5pbXBvcnQgZG9jUmVhZHkgZnJvbSBcImRvYy1yZWFkeVwiXG5pbXBvcnQgdGFncyBmcm9tIFwiLi90YWdzXCJcblxuY2xhc3MgQ29weUJ1dHRvbiBleHRlbmRzIENvbXBvbmVudHtcbiAgb25SZW5kZXIoe3RhcmdldH0pe1xuICAgIGxldCBpZCA9IFwiX19jb3B5X19idXR0b25fX1wiXG4gICAgdGhpcy5jbGlwYm9hcmQgPSBuZXcgQ2xpcGJvYXJkKGAjJHtpZH1gKVxuXG4gICAgcmV0dXJuIG5vZGUoXCJidXR0b25cIilcbiAgICAgIC5hdHRycyh7XG4gICAgICAgIFwiaWRcIjogaWQsXG4gICAgICAgIFwiZGF0YS1jbGlwYm9hcmQtdGFyZ2V0XCI6IHRhcmdldFxuICAgICAgfSlcbiAgICAgIC5jaGlsZHJlbihcIkNvcHlcIilcbiAgfVxufVxuXG5jbGFzcyBUYWcgZXh0ZW5kcyBDb21wb25lbnR7XG4gIG9uUmVuZGVyKHt0YWd9KXtcbiAgICByZXR1cm4gbm9kZShcInNwYW5cIikuY2hpbGRyZW4oYCMke3RhZ30gYClcbiAgfVxufVxuY2xhc3MgVGFncyBleHRlbmRzIENvbXBvbmVudHtcbiAgb25SZW5kZXIoeyB0YWdzLCBpZCB9KXtcbiAgICByZXR1cm4gbm9kZShcImRpdlwiKVxuICAgICAgLmF0dHJzKHtpZH0pXG4gICAgICAuY2hpbGRyZW4oXG4gICAgICAgIHRhZ3MubWFwKCAodGFnKSA9PiB7XG4gICAgICAgICAgcmV0dXJuIG5vZGUoVGFnKS5hdHRycyh7dGFnfSlcbiAgICAgICAgfSlcbiAgICAgIClcbiAgfVxufVxuY2xhc3MgQXBwIGV4dGVuZHMgQ29tcG9uZW50e1xuICBvblJlbmRlcih7dGFnc30pe1xuICAgIGxldCB0YWdzSWQgPSBcIl9fdGFnc1wiXG4gICAgcmV0dXJuIG5vZGUoXCJkaXZcIilcbiAgICAgIC5jaGlsZHJlbihbXG4gICAgICAgIG5vZGUoQ29weUJ1dHRvbikuYXR0cnMoeyB0YXJnZXQ6IGAjJHt0YWdzSWR9YCB9KSxcbiAgICAgICAgbm9kZShUYWdzKS5hdHRycyh7IHRhZ3MsIGlkOnRhZ3NJZCB9KSxcbiAgICAgIF0pXG4gIH1cbn1cblxuZG9jUmVhZHkoIGZ1bmN0aW9uKCl7XG4gIGxldCBjb250YWluZXIgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY29udGFpbmVyJylcbiAgbGV0IHRzID0gdGFncygpLnRoZW4odGFncyA9PiB7XG4gICAgbW91bnRUb0RvbShjb250YWluZXIsIG5vZGUoQXBwKS5hdHRycyh7dGFnczogdGFnc30pKTtcbiAgfSlcbn0pXG4iLCJpbXBvcnQgYXhpb3MgZnJvbSBcImF4aW9zXCJcbmltcG9ydCBDaGFuY2UgZnJvbSBcImNoYW5jZVwiXG5jb25zdCBwcmltYXJ5VGFnID0gW1wiZG9nXCIsIFwibm9yZm9sa3RlcnJpZXJcIl1cblxuZnVuY3Rpb24gc2h1ZmZsZSh0YWdzKXtcbiAgbGV0IGNoYW5jZSA9IG5ldyBDaGFuY2UoKVxuICByZXR1cm4gY2hhbmNlLnNodWZmbGUodGFncylcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24obnVtID0gMjUpe1xuICByZXR1cm4gYXhpb3MoXCIuL3RhZ3MudHh0XCIpLnRoZW4oIHJlcyA9PiB7XG4gICAgcmV0dXJuIHJlcy5kYXRhLnNwbGl0KFwiXFxuXCIpLmZpbHRlcihmdW5jdGlvbih0YWcpe1xuICAgICAgcmV0dXJuIHRhZy5sZW5ndGggPiAwXG4gICAgfSlcbiAgfSkudGhlbih0YWdzID0+IHtcbiAgICByZXR1cm4gc2h1ZmZsZSh0YWdzKS5zcGxpY2UoMCwgbnVtKVxuICB9KS50aGVuKHRhZ3MgPT4ge1xuICAgIHJldHVybiBwcmltYXJ5VGFnLmNvbmNhdCh0YWdzKVxuICB9KVxufSJdfQ==

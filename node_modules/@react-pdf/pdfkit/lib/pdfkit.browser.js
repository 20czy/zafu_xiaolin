import require$$1$2 from 'pako/lib/zlib/zstream.js';
import require$$2 from 'pako/lib/zlib/deflate.js';
import require$$3$1 from 'pako/lib/zlib/inflate.js';
import require$$4$1 from 'pako/lib/zlib/constants.js';
import MD5 from 'crypto-js/md5.js';
import * as fontkit from 'fontkit';
import _JPEG from 'jay-peg';
import PNG from '@react-pdf/png-js';
import * as CryptoJS from 'crypto-js/core.js';

var global$1 = (typeof global !== "undefined" ? global :
  typeof self !== "undefined" ? self :
  typeof window !== "undefined" ? window : {});

var lookup = [];
var revLookup = [];
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
var inited = false;
function init () {
  inited = true;
  var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i];
    revLookup[code.charCodeAt(i)] = i;
  }

  revLookup['-'.charCodeAt(0)] = 62;
  revLookup['_'.charCodeAt(0)] = 63;
}

function toByteArray (b64) {
  if (!inited) {
    init();
  }
  var i, j, l, tmp, placeHolders, arr;
  var len = b64.length;

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // the number of equal signs (place holders)
  // if there are two placeholders, than the two characters before it
  // represent one byte
  // if there is only one, then the three characters before it represent 2 bytes
  // this is just a cheap hack to not do indexOf twice
  placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

  // base64 is 4/3 + up to two characters of the original data
  arr = new Arr(len * 3 / 4 - placeHolders);

  // if there are placeholders, only get up to the last complete 4 chars
  l = placeHolders > 0 ? len - 4 : len;

  var L = 0;

  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
    arr[L++] = (tmp >> 16) & 0xFF;
    arr[L++] = (tmp >> 8) & 0xFF;
    arr[L++] = tmp & 0xFF;
  }

  if (placeHolders === 2) {
    tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
    arr[L++] = tmp & 0xFF;
  } else if (placeHolders === 1) {
    tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
    arr[L++] = (tmp >> 8) & 0xFF;
    arr[L++] = tmp & 0xFF;
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp;
  var output = [];
  for (var i = start; i < end; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
    output.push(tripletToBase64(tmp));
  }
  return output.join('')
}

function fromByteArray (uint8) {
  if (!inited) {
    init();
  }
  var tmp;
  var len = uint8.length;
  var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
  var output = '';
  var parts = [];
  var maxChunkLength = 16383; // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1];
    output += lookup[tmp >> 2];
    output += lookup[(tmp << 4) & 0x3F];
    output += '==';
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
    output += lookup[tmp >> 10];
    output += lookup[(tmp >> 4) & 0x3F];
    output += lookup[(tmp << 2) & 0x3F];
    output += '=';
  }

  parts.push(output);

  return parts.join('')
}

function read (buffer, offset, isLE, mLen, nBytes) {
  var e, m;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var nBits = -7;
  var i = isLE ? (nBytes - 1) : 0;
  var d = isLE ? -1 : 1;
  var s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

function write (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
  var i = isLE ? 0 : (nBytes - 1);
  var d = isLE ? 1 : -1;
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128;
}

var toString = {}.toString;

var isArray$1 = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */


var INSPECT_MAX_BYTES = 50;

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
Buffer$2.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
  ? global$1.TYPED_ARRAY_SUPPORT
  : true;

/*
 * Export kMaxLength after typed array support is determined.
 */
var _kMaxLength = kMaxLength();

function kMaxLength () {
  return Buffer$2.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

function createBuffer (that, length) {
  if (kMaxLength() < length) {
    throw new RangeError('Invalid typed array length')
  }
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = new Uint8Array(length);
    that.__proto__ = Buffer$2.prototype;
  } else {
    // Fallback: Return an object instance of the Buffer class
    if (that === null) {
      that = new Buffer$2(length);
    }
    that.length = length;
  }

  return that
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

function Buffer$2 (arg, encodingOrOffset, length) {
  if (!Buffer$2.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer$2)) {
    return new Buffer$2(arg, encodingOrOffset, length)
  }

  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new Error(
        'If encoding is specified then the first argument must be a string'
      )
    }
    return allocUnsafe(this, arg)
  }
  return from$1(this, arg, encodingOrOffset, length)
}

Buffer$2.poolSize = 8192; // not used by this implementation

// TODO: Legacy, not needed anymore. Remove in next major version.
Buffer$2._augment = function (arr) {
  arr.__proto__ = Buffer$2.prototype;
  return arr
};

function from$1 (that, value, encodingOrOffset, length) {
  if (typeof value === 'number') {
    throw new TypeError('"value" argument must not be a number')
  }

  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length)
  }

  if (typeof value === 'string') {
    return fromString(that, value, encodingOrOffset)
  }

  return fromObject(that, value)
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer$2.from = function (value, encodingOrOffset, length) {
  return from$1(null, value, encodingOrOffset, length)
};

if (Buffer$2.TYPED_ARRAY_SUPPORT) {
  Buffer$2.prototype.__proto__ = Uint8Array.prototype;
  Buffer$2.__proto__ = Uint8Array;
  if (typeof Symbol !== 'undefined' && Symbol.species &&
      Buffer$2[Symbol.species] === Buffer$2) ;
}

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be a number')
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative')
  }
}

function alloc (that, size, fill, encoding) {
  assertSize(size);
  if (size <= 0) {
    return createBuffer(that, size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(that, size).fill(fill, encoding)
      : createBuffer(that, size).fill(fill)
  }
  return createBuffer(that, size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer$2.alloc = function (size, fill, encoding) {
  return alloc(null, size, fill, encoding)
};

function allocUnsafe (that, size) {
  assertSize(size);
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
  if (!Buffer$2.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0;
    }
  }
  return that
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer$2.allocUnsafe = function (size) {
  return allocUnsafe(null, size)
};
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer$2.allocUnsafeSlow = function (size) {
  return allocUnsafe(null, size)
};

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8';
  }

  if (!Buffer$2.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding')
  }

  var length = byteLength(string, encoding) | 0;
  that = createBuffer(that, length);

  var actual = that.write(string, encoding);

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    that = that.slice(0, actual);
  }

  return that
}

function fromArrayLike (that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0;
  that = createBuffer(that, length);
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255;
  }
  return that
}

function fromArrayBuffer (that, array, byteOffset, length) {
  array.byteLength; // this throws if `array` is not a valid ArrayBuffer

  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('\'offset\' is out of bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('\'length\' is out of bounds')
  }

  if (byteOffset === undefined && length === undefined) {
    array = new Uint8Array(array);
  } else if (length === undefined) {
    array = new Uint8Array(array, byteOffset);
  } else {
    array = new Uint8Array(array, byteOffset, length);
  }

  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = array;
    that.__proto__ = Buffer$2.prototype;
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromArrayLike(that, array);
  }
  return that
}

function fromObject (that, obj) {
  if (internalIsBuffer(obj)) {
    var len = checked(obj.length) | 0;
    that = createBuffer(that, len);

    if (that.length === 0) {
      return that
    }

    obj.copy(that, 0, 0, len);
    return that
  }

  if (obj) {
    if ((typeof ArrayBuffer !== 'undefined' &&
        obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
      if (typeof obj.length !== 'number' || isnan(obj.length)) {
        return createBuffer(that, 0)
      }
      return fromArrayLike(that, obj)
    }

    if (obj.type === 'Buffer' && isArray$1(obj.data)) {
      return fromArrayLike(that, obj.data)
    }
  }

  throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
}

function checked (length) {
  // Note: cannot use `length < kMaxLength()` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0;
  }
  return Buffer$2.alloc(+length)
}
Buffer$2.isBuffer = isBuffer$1;
function internalIsBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer$2.compare = function compare (a, b) {
  if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
};

Buffer$2.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
};

Buffer$2.concat = function concat (list, length) {
  if (!isArray$1(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer$2.alloc(0)
  }

  var i;
  if (length === undefined) {
    length = 0;
    for (i = 0; i < list.length; ++i) {
      length += list[i].length;
    }
  }

  var buffer = Buffer$2.allocUnsafe(length);
  var pos = 0;
  for (i = 0; i < list.length; ++i) {
    var buf = list[i];
    if (!internalIsBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos);
    pos += buf.length;
  }
  return buffer
};

function byteLength (string, encoding) {
  if (internalIsBuffer(string)) {
    return string.length
  }
  if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
      (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    string = '' + string;
  }

  var len = string.length;
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
      case undefined:
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
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer$2.byteLength = byteLength;

function slowToString (encoding, start, end) {
  var loweredCase = false;

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0;
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length;
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0;
  start >>>= 0;

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8';

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase();
        loweredCase = true;
    }
  }
}

// The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
// Buffer instances.
Buffer$2.prototype._isBuffer = true;

function swap (b, n, m) {
  var i = b[n];
  b[n] = b[m];
  b[m] = i;
}

Buffer$2.prototype.swap16 = function swap16 () {
  var len = this.length;
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1);
  }
  return this
};

Buffer$2.prototype.swap32 = function swap32 () {
  var len = this.length;
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3);
    swap(this, i + 1, i + 2);
  }
  return this
};

Buffer$2.prototype.swap64 = function swap64 () {
  var len = this.length;
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7);
    swap(this, i + 1, i + 6);
    swap(this, i + 2, i + 5);
    swap(this, i + 3, i + 4);
  }
  return this
};

Buffer$2.prototype.toString = function toString () {
  var length = this.length | 0;
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
};

Buffer$2.prototype.equals = function equals (b) {
  if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer$2.compare(this, b) === 0
};

Buffer$2.prototype.inspect = function inspect () {
  var str = '';
  var max = INSPECT_MAX_BYTES;
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
    if (this.length > max) str += ' ... ';
  }
  return '<Buffer ' + str + '>'
};

Buffer$2.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (!internalIsBuffer(target)) {
    throw new TypeError('Argument must be a Buffer')
  }

  if (start === undefined) {
    start = 0;
  }
  if (end === undefined) {
    end = target ? target.length : 0;
  }
  if (thisStart === undefined) {
    thisStart = 0;
  }
  if (thisEnd === undefined) {
    thisEnd = this.length;
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0;
  end >>>= 0;
  thisStart >>>= 0;
  thisEnd >>>= 0;

  if (this === target) return 0

  var x = thisEnd - thisStart;
  var y = end - start;
  var len = Math.min(x, y);

  var thisCopy = this.slice(thisStart, thisEnd);
  var targetCopy = target.slice(start, end);

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i];
      y = targetCopy[i];
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
};

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset;
    byteOffset = 0;
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff;
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000;
  }
  byteOffset = +byteOffset;  // Coerce to Number.
  if (isNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1);
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1;
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0;
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer$2.from(val, encoding);
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (internalIsBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF; // Search for a byte value [0-255]
    if (Buffer$2.TYPED_ARRAY_SUPPORT &&
        typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1;
  var arrLength = arr.length;
  var valLength = val.length;

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase();
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2;
      arrLength /= 2;
      valLength /= 2;
      byteOffset /= 2;
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i;
  if (dir) {
    var foundIndex = -1;
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i;
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex;
        foundIndex = -1;
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
    for (i = byteOffset; i >= 0; i--) {
      var found = true;
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false;
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer$2.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
};

Buffer$2.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
};

Buffer$2.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
};

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0;
  var remaining = buf.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = Number(length);
    if (length > remaining) {
      length = remaining;
    }
  }

  // must be an even number of digits
  var strLen = string.length;
  if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2;
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16);
    if (isNaN(parsed)) return i
    buf[offset + i] = parsed;
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer$2.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8';
    length = this.length;
    offset = 0;
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset;
    length = this.length;
    offset = 0;
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0;
    if (isFinite(length)) {
      length = length | 0;
      if (encoding === undefined) encoding = 'utf8';
    } else {
      encoding = length;
      length = undefined;
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset;
  if (length === undefined || length > remaining) length = remaining;

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8';

  var loweredCase = false;
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

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
        encoding = ('' + encoding).toLowerCase();
        loweredCase = true;
    }
  }
};

Buffer$2.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
};

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return fromByteArray(buf)
  } else {
    return fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end);
  var res = [];

  var i = start;
  while (i < end) {
    var firstByte = buf[i];
    var codePoint = null;
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1;

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint;

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte;
          }
          break
        case 2:
          secondByte = buf[i + 1];
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint;
            }
          }
          break
        case 3:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint;
            }
          }
          break
        case 4:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          fourthByte = buf[i + 3];
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint;
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD;
      bytesPerSequence = 1;
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000;
      res.push(codePoint >>> 10 & 0x3FF | 0xD800);
      codePoint = 0xDC00 | codePoint & 0x3FF;
    }

    res.push(codePoint);
    i += bytesPerSequence;
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000;

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length;
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = '';
  var i = 0;
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    );
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F);
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = '';
  end = Math.min(buf.length, end);

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i]);
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length;

  if (!start || start < 0) start = 0;
  if (!end || end < 0 || end > len) end = len;

  var out = '';
  for (var i = start; i < end; ++i) {
    out += toHex$1(buf[i]);
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end);
  var res = '';
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
  }
  return res
}

Buffer$2.prototype.slice = function slice (start, end) {
  var len = this.length;
  start = ~~start;
  end = end === undefined ? len : ~~end;

  if (start < 0) {
    start += len;
    if (start < 0) start = 0;
  } else if (start > len) {
    start = len;
  }

  if (end < 0) {
    end += len;
    if (end < 0) end = 0;
  } else if (end > len) {
    end = len;
  }

  if (end < start) end = start;

  var newBuf;
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end);
    newBuf.__proto__ = Buffer$2.prototype;
  } else {
    var sliceLen = end - start;
    newBuf = new Buffer$2(sliceLen, undefined);
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start];
    }
  }

  return newBuf
};

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer$2.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }

  return val
};

Buffer$2.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length);
  }

  var val = this[offset + --byteLength];
  var mul = 1;
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul;
  }

  return val
};

Buffer$2.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  return this[offset]
};

Buffer$2.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return this[offset] | (this[offset + 1] << 8)
};

Buffer$2.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  return (this[offset] << 8) | this[offset + 1]
};

Buffer$2.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
};

Buffer$2.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
};

Buffer$2.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var val = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul;
  }
  mul *= 0x80;

  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

  return val
};

Buffer$2.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) checkOffset(offset, byteLength, this.length);

  var i = byteLength;
  var mul = 1;
  var val = this[offset + --i];
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul;
  }
  mul *= 0x80;

  if (val >= mul) val -= Math.pow(2, 8 * byteLength);

  return val
};

Buffer$2.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length);
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
};

Buffer$2.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset] | (this[offset + 1] << 8);
  return (val & 0x8000) ? val | 0xFFFF0000 : val
};

Buffer$2.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length);
  var val = this[offset + 1] | (this[offset] << 8);
  return (val & 0x8000) ? val | 0xFFFF0000 : val
};

Buffer$2.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
};

Buffer$2.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
};

Buffer$2.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, true, 23, 4)
};

Buffer$2.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length);
  return read(this, offset, false, 23, 4)
};

Buffer$2.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, true, 52, 8)
};

Buffer$2.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length);
  return read(this, offset, false, 52, 8)
};

function checkInt (buf, value, offset, ext, max, min) {
  if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer$2.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  var mul = 1;
  var i = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF;
  }

  return offset + byteLength
};

Buffer$2.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength = byteLength | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1;
    checkInt(this, value, offset, byteLength, maxBytes, 0);
  }

  var i = byteLength - 1;
  var mul = 1;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF;
  }

  return offset + byteLength
};

Buffer$2.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
  if (!Buffer$2.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  this[offset] = (value & 0xff);
  return offset + 1
};

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8;
  }
}

Buffer$2.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2
};

Buffer$2.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8);
    this[offset + 1] = (value & 0xff);
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2
};

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
  }
}

Buffer$2.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24);
    this[offset + 2] = (value >>> 16);
    this[offset + 1] = (value >>> 8);
    this[offset] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4
};

Buffer$2.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24);
    this[offset + 1] = (value >>> 16);
    this[offset + 2] = (value >>> 8);
    this[offset + 3] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4
};

Buffer$2.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);

    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  var i = 0;
  var mul = 1;
  var sub = 0;
  this[offset] = value & 0xFF;
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
  }

  return offset + byteLength
};

Buffer$2.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1);

    checkInt(this, value, offset, byteLength, limit - 1, -limit);
  }

  var i = byteLength - 1;
  var mul = 1;
  var sub = 0;
  this[offset + i] = value & 0xFF;
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
  }

  return offset + byteLength
};

Buffer$2.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
  if (!Buffer$2.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
  if (value < 0) value = 0xff + value + 1;
  this[offset] = (value & 0xff);
  return offset + 1
};

Buffer$2.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2
};

Buffer$2.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8);
    this[offset + 1] = (value & 0xff);
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2
};

Buffer$2.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff);
    this[offset + 1] = (value >>> 8);
    this[offset + 2] = (value >>> 16);
    this[offset + 3] = (value >>> 24);
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4
};

Buffer$2.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
  if (value < 0) value = 0xffffffff + value + 1;
  if (Buffer$2.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24);
    this[offset + 1] = (value >>> 16);
    this[offset + 2] = (value >>> 8);
    this[offset + 3] = (value & 0xff);
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4
};

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4);
  }
  write(buf, value, offset, littleEndian, 23, 4);
  return offset + 4
}

Buffer$2.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
};

Buffer$2.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
};

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8);
  }
  write(buf, value, offset, littleEndian, 52, 8);
  return offset + 8
}

Buffer$2.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
};

Buffer$2.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
};

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer$2.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0;
  if (!end && end !== 0) end = this.length;
  if (targetStart >= target.length) targetStart = target.length;
  if (!targetStart) targetStart = 0;
  if (end > 0 && end < start) end = start;

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
  if (end > this.length) end = this.length;
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start;
  }

  var len = end - start;
  var i;

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start];
    }
  } else if (len < 1000 || !Buffer$2.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start];
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, start + len),
      targetStart
    );
  }

  return len
};

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer$2.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start;
      start = 0;
      end = this.length;
    } else if (typeof end === 'string') {
      encoding = end;
      end = this.length;
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0);
      if (code < 256) {
        val = code;
      }
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer$2.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
  } else if (typeof val === 'number') {
    val = val & 255;
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0;
  end = end === undefined ? this.length : end >>> 0;

  if (!val) val = 0;

  var i;
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val;
    }
  } else {
    var bytes = internalIsBuffer(val)
      ? val
      : utf8ToBytes(new Buffer$2(val, encoding).toString());
    var len = bytes.length;
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len];
    }
  }

  return this
};

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '');
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '=';
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex$1 (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity;
  var codePoint;
  var length = string.length;
  var leadSurrogate = null;
  var bytes = [];

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i);

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
          continue
        }

        // valid lead
        leadSurrogate = codePoint;

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
        leadSurrogate = codePoint;
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
    }

    leadSurrogate = null;

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint);
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF);
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo;
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i);
    hi = c >> 8;
    lo = c % 256;
    byteArray.push(lo);
    byteArray.push(hi);
  }

  return byteArray
}


function base64ToBytes (str) {
  return toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i];
  }
  return i
}

function isnan (val) {
  return val !== val // eslint-disable-line no-self-compare
}


// the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
function isBuffer$1(obj) {
  return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
}

function isFastBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0))
}

var _polyfillNode_buffer = /*#__PURE__*/Object.freeze({
  __proto__: null,
  Buffer: Buffer$2,
  INSPECT_MAX_BYTES: INSPECT_MAX_BYTES,
  SlowBuffer: SlowBuffer,
  isBuffer: isBuffer$1,
  kMaxLength: _kMaxLength
});

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

function getAugmentedNamespace(n) {
  if (n.__esModule) return n;
  var f = n.default;
	if (typeof f == "function") {
		var a = function a () {
			if (this instanceof a) {
        return Reflect.construct(f, arguments, this.constructor);
			}
			return f.apply(this, arguments);
		};
		a.prototype = f.prototype;
  } else a = {};
  Object.defineProperty(a, '__esModule', {value: true});
	Object.keys(n).forEach(function (k) {
		var d = Object.getOwnPropertyDescriptor(n, k);
		Object.defineProperty(a, k, d.get ? d : {
			enumerable: true,
			get: function () {
				return n[k];
			}
		});
	});
	return a;
}

var readableBrowser = {exports: {}};

var _registry = {};

// shim for using process in browser
// based off https://github.com/defunctzombie/node-process/blob/master/browser.js

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
var cachedSetTimeout = defaultSetTimout;
var cachedClearTimeout = defaultClearTimeout;
if (typeof global$1.setTimeout === 'function') {
    cachedSetTimeout = setTimeout;
}
if (typeof global$1.clearTimeout === 'function') {
    cachedClearTimeout = clearTimeout;
}

function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
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
    var timeout = runTimeout(cleanUpNextTick);
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
    runClearTimeout(timeout);
}
function nextTick(fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
}
// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
var title = 'browser';
var platform = 'browser';
var browser$1 = true;
var env = {};
var argv = [];
var version = ''; // empty string to avoid regexp issues
var versions = {};
var release = {};
var config$1 = {};

function noop$2() {}

var on = noop$2;
var addListener = noop$2;
var once$2 = noop$2;
var off = noop$2;
var removeListener = noop$2;
var removeAllListeners = noop$2;
var emit = noop$2;

function binding$1(name) {
    throw new Error('process.binding is not supported');
}

function cwd () { return '/' }
function chdir (dir) {
    throw new Error('process.chdir is not supported');
}function umask() { return 0; }

// from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
var performance = global$1.performance || {};
var performanceNow =
  performance.now        ||
  performance.mozNow     ||
  performance.msNow      ||
  performance.oNow       ||
  performance.webkitNow  ||
  function(){ return (new Date()).getTime() };

// generate timestamp or delta
// see http://nodejs.org/api/process.html#process_process_hrtime
function hrtime(previousTimestamp){
  var clocktime = performanceNow.call(performance)*1e-3;
  var seconds = Math.floor(clocktime);
  var nanoseconds = Math.floor((clocktime%1)*1e9);
  if (previousTimestamp) {
    seconds = seconds - previousTimestamp[0];
    nanoseconds = nanoseconds - previousTimestamp[1];
    if (nanoseconds<0) {
      seconds--;
      nanoseconds += 1e9;
    }
  }
  return [seconds,nanoseconds]
}

var startTime = new Date();
function uptime() {
  var currentTime = new Date();
  var dif = currentTime - startTime;
  return dif / 1000;
}

var browser$1$1 = {
  nextTick: nextTick,
  title: title,
  browser: browser$1,
  env: env,
  argv: argv,
  version: version,
  versions: versions,
  on: on,
  addListener: addListener,
  once: once$2,
  off: off,
  removeListener: removeListener,
  removeAllListeners: removeAllListeners,
  emit: emit,
  binding: binding$1,
  cwd: cwd,
  chdir: chdir,
  umask: umask,
  hrtime: hrtime,
  platform: platform,
  release: release,
  config: config$1,
  uptime: uptime
};

var domain;

// This constructor is used to store event handlers. Instantiating this is
// faster than explicitly calling `Object.create(null)` to get a "clean" empty
// object (tested with v8 v4.9).
function EventHandlers() {}
EventHandlers.prototype = Object.create(null);

function EventEmitter() {
  EventEmitter.init.call(this);
}

// nodejs oddity
// require('events') === require('events').EventEmitter
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.usingDomains = false;

EventEmitter.prototype.domain = undefined;
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

EventEmitter.init = function() {
  this.domain = null;
  if (EventEmitter.usingDomains) {
    // if there is an active domain, then attach to it.
    if (domain.active ) ;
  }

  if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
    this._events = new EventHandlers();
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events, domain;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  domain = this.domain;

  // If there is no 'error' event listener then throw.
  if (doError) {
    er = arguments[1];
    if (domain) {
      if (!er)
        er = new Error('Uncaught, unspecified "error" event');
      er.domainEmitter = this;
      er.domain = domain;
      er.domainThrown = false;
      domain.emit('error', er);
    } else if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
    // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
    // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = new EventHandlers();
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] = prepend ? [listener, existing] :
                                          [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
                            existing.length + ' ' + type + ' listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        emitWarning(w);
      }
    }
  }

  return target;
}
function emitWarning(e) {
  typeof console.warn === 'function' ? console.warn(e) : console.log(e);
}
EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function _onceWrap(target, type, listener) {
  var fired = false;
  function g() {
    target.removeListener(type, g);
    if (!fired) {
      fired = true;
      listener.apply(target, arguments);
    }
  }
  g.listener = listener;
  return g;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || (list.listener && list.listener === listener)) {
        if (--this._eventsCount === 0)
          this._events = new EventHandlers();
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length; i-- > 0;) {
          if (list[i] === listener ||
              (list[i].listener && list[i].listener === listener)) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (list.length === 1) {
          list[0] = undefined;
          if (--this._eventsCount === 0) {
            this._events = new EventHandlers();
            return this;
          } else {
            delete events[type];
          }
        } else {
          spliceOne(list, position);
        }

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };
    
// Alias for removeListener added in NodeJS 10.0
// https://nodejs.org/api/events.html#events_emitter_off_eventname_listener
EventEmitter.prototype.off = function(type, listener){
    return this.removeListener(type, listener);
};

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = new EventHandlers();
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = new EventHandlers();
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        for (var i = 0, key; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = new EventHandlers();
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        do {
          this.removeListener(type, listeners[listeners.length - 1]);
        } while (listeners[0]);
      }

      return this;
    };

EventEmitter.prototype.listeners = function listeners(type) {
  var evlistener;
  var ret;
  var events = this._events;

  if (!events)
    ret = [];
  else {
    evlistener = events[type];
    if (!evlistener)
      ret = [];
    else if (typeof evlistener === 'function')
      ret = [evlistener.listener || evlistener];
    else
      ret = unwrapListeners(evlistener);
  }

  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, i) {
  var copy = new Array(i);
  while (i--)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

var _polyfillNode_events = /*#__PURE__*/Object.freeze({
  __proto__: null,
  EventEmitter: EventEmitter,
  default: EventEmitter
});

var require$$1$1 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_events);

var streamBrowser = require$$1$1.EventEmitter;

var require$$0 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_buffer);

var inherits$2;
if (typeof Object.create === 'function'){
  inherits$2 = function inherits(ctor, superCtor) {
    // implementation from standard node.js 'util' module
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  inherits$2 = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    var TempCtor = function () {};
    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  };
}
var inherits$3 = inherits$2;

var getOwnPropertyDescriptors = Object.getOwnPropertyDescriptors ||
  function getOwnPropertyDescriptors(obj) {
    var keys = Object.keys(obj);
    var descriptors = {};
    for (var i = 0; i < keys.length; i++) {
      descriptors[keys[i]] = Object.getOwnPropertyDescriptor(obj, keys[i]);
    }
    return descriptors;
  };

var formatRegExp = /%[sdj%]/g;
function format(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect$1(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect$1(x);
    }
  }
  return str;
}

// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
function deprecate$1(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global$1.process)) {
    return function() {
      return deprecate$1(fn, msg).apply(this, arguments);
    };
  }

  if (browser$1$1.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (browser$1$1.throwDeprecation) {
        throw new Error(msg);
      } else if (browser$1$1.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

var debugs = {};
var debugEnviron;
function debuglog(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = browser$1$1.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = 0;
      debugs[set] = function() {
        var msg = format.apply(null, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
}

/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect$1(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    _extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}

// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect$1.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect$1.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect$1.styles[styleType];

  if (style) {
    return '\u001b[' + inspect$1.colors[style][0] + 'm' + str +
           '\u001b[' + inspect$1.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== inspect$1 &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var length = output.reduce(function(prev, cur) {
    if (cur.indexOf('\n') >= 0) ;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}

function isBoolean(arg) {
  return typeof arg === 'boolean';
}

function isNull(arg) {
  return arg === null;
}

function isNullOrUndefined(arg) {
  return arg == null;
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isString(arg) {
  return typeof arg === 'string';
}

function isSymbol(arg) {
  return typeof arg === 'symbol';
}

function isUndefined(arg) {
  return arg === void 0;
}

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}

function isFunction(arg) {
  return typeof arg === 'function';
}

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}

function isBuffer(maybeBuf) {
  return Buffer$2.isBuffer(maybeBuf);
}

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad$1(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad$1(d.getHours()),
              pad$1(d.getMinutes()),
              pad$1(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
function log() {
  console.log('%s - %s', timestamp(), format.apply(null, arguments));
}

function _extend(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
}
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

var kCustomPromisifiedSymbol = typeof Symbol !== 'undefined' ? Symbol('util.promisify.custom') : undefined;

function promisify(original) {
  if (typeof original !== 'function')
    throw new TypeError('The "original" argument must be of type Function');

  if (kCustomPromisifiedSymbol && original[kCustomPromisifiedSymbol]) {
    var fn = original[kCustomPromisifiedSymbol];
    if (typeof fn !== 'function') {
      throw new TypeError('The "util.promisify.custom" argument must be of type Function');
    }
    Object.defineProperty(fn, kCustomPromisifiedSymbol, {
      value: fn, enumerable: false, writable: false, configurable: true
    });
    return fn;
  }

  function fn() {
    var promiseResolve, promiseReject;
    var promise = new Promise(function (resolve, reject) {
      promiseResolve = resolve;
      promiseReject = reject;
    });

    var args = [];
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }
    args.push(function (err, value) {
      if (err) {
        promiseReject(err);
      } else {
        promiseResolve(value);
      }
    });

    try {
      original.apply(this, args);
    } catch (err) {
      promiseReject(err);
    }

    return promise;
  }

  Object.setPrototypeOf(fn, Object.getPrototypeOf(original));

  if (kCustomPromisifiedSymbol) Object.defineProperty(fn, kCustomPromisifiedSymbol, {
    value: fn, enumerable: false, writable: false, configurable: true
  });
  return Object.defineProperties(
    fn,
    getOwnPropertyDescriptors(original)
  );
}

promisify.custom = kCustomPromisifiedSymbol;

function callbackifyOnRejected(reason, cb) {
  // `!reason` guard inspired by bluebird (Ref: https://goo.gl/t5IS6M).
  // Because `null` is a special error value in callbacks which means "no error
  // occurred", we error-wrap so the callback consumer can distinguish between
  // "the promise rejected with null" or "the promise fulfilled with undefined".
  if (!reason) {
    var newReason = new Error('Promise was rejected with a falsy value');
    newReason.reason = reason;
    reason = newReason;
  }
  return cb(reason);
}

function callbackify(original) {
  if (typeof original !== 'function') {
    throw new TypeError('The "original" argument must be of type Function');
  }

  // We DO NOT return the promise as it gives the user a false sense that
  // the promise is actually somehow related to the callback's execution
  // and that the callback throwing will reject the promise.
  function callbackified() {
    var args = [];
    for (var i = 0; i < arguments.length; i++) {
      args.push(arguments[i]);
    }

    var maybeCb = args.pop();
    if (typeof maybeCb !== 'function') {
      throw new TypeError('The last argument must be of type Function');
    }
    var self = this;
    var cb = function() {
      return maybeCb.apply(self, arguments);
    };
    // In true node style we process the callback on `nextTick` with all the
    // implications (stack, `uncaughtException`, `async_hooks`)
    original.apply(this, args)
      .then(function(ret) { browser$1$1.nextTick(cb.bind(null, null, ret)); },
        function(rej) { browser$1$1.nextTick(callbackifyOnRejected.bind(null, rej, cb)); });
  }

  Object.setPrototypeOf(callbackified, Object.getPrototypeOf(original));
  Object.defineProperties(callbackified, getOwnPropertyDescriptors(original));
  return callbackified;
}

var _polyfillNode_util = {
  inherits: inherits$3,
  _extend: _extend,
  log: log,
  isBuffer: isBuffer,
  isPrimitive: isPrimitive,
  isFunction: isFunction,
  isError: isError,
  isDate: isDate,
  isObject: isObject,
  isRegExp: isRegExp,
  isUndefined: isUndefined,
  isSymbol: isSymbol,
  isString: isString,
  isNumber: isNumber,
  isNullOrUndefined: isNullOrUndefined,
  isNull: isNull,
  isBoolean: isBoolean,
  isArray: isArray,
  inspect: inspect$1,
  deprecate: deprecate$1,
  format: format,
  debuglog: debuglog,
  promisify: promisify,
  callbackify: callbackify,
};

var _polyfillNode_util$1 = /*#__PURE__*/Object.freeze({
  __proto__: null,
  _extend: _extend,
  callbackify: callbackify,
  debuglog: debuglog,
  default: _polyfillNode_util,
  deprecate: deprecate$1,
  format: format,
  inherits: inherits$3,
  inspect: inspect$1,
  isArray: isArray,
  isBoolean: isBoolean,
  isBuffer: isBuffer,
  isDate: isDate,
  isError: isError,
  isFunction: isFunction,
  isNull: isNull,
  isNullOrUndefined: isNullOrUndefined,
  isNumber: isNumber,
  isObject: isObject,
  isPrimitive: isPrimitive,
  isRegExp: isRegExp,
  isString: isString,
  isSymbol: isSymbol,
  isUndefined: isUndefined,
  log: log,
  promisify: promisify
});

var require$$3 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_util$1);

var buffer_list;
var hasRequiredBuffer_list;
function requireBuffer_list() {
  if (hasRequiredBuffer_list) return buffer_list;
  hasRequiredBuffer_list = 1;
  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);
    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      if (enumerableOnly) symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
      keys.push.apply(keys, symbols);
    }
    return keys;
  }
  function _objectSpread(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = arguments[i] != null ? arguments[i] : {};
      if (i % 2) {
        ownKeys(Object(source), true).forEach(function (key) {
          _defineProperty(target, key, source[key]);
        });
      } else if (Object.getOwnPropertyDescriptors) {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
      } else {
        ownKeys(Object(source)).forEach(function (key) {
          Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
        });
      }
    }
    return target;
  }
  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }
    return obj;
  }
  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }
  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }
  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    return Constructor;
  }
  var _require = require$$0,
    Buffer = _require.Buffer;
  var _require2 = require$$3,
    inspect = _require2.inspect;
  var custom = inspect && inspect.custom || 'inspect';
  function copyBuffer(src, target, offset) {
    Buffer.prototype.copy.call(src, target, offset);
  }
  buffer_list = /*#__PURE__*/
  function () {
    function BufferList() {
      _classCallCheck(this, BufferList);
      this.head = null;
      this.tail = null;
      this.length = 0;
    }
    _createClass(BufferList, [{
      key: "push",
      value: function push(v) {
        var entry = {
          data: v,
          next: null
        };
        if (this.length > 0) this.tail.next = entry;else this.head = entry;
        this.tail = entry;
        ++this.length;
      }
    }, {
      key: "unshift",
      value: function unshift(v) {
        var entry = {
          data: v,
          next: this.head
        };
        if (this.length === 0) this.tail = entry;
        this.head = entry;
        ++this.length;
      }
    }, {
      key: "shift",
      value: function shift() {
        if (this.length === 0) return;
        var ret = this.head.data;
        if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
        --this.length;
        return ret;
      }
    }, {
      key: "clear",
      value: function clear() {
        this.head = this.tail = null;
        this.length = 0;
      }
    }, {
      key: "join",
      value: function join(s) {
        if (this.length === 0) return '';
        var p = this.head;
        var ret = '' + p.data;
        while (p = p.next) {
          ret += s + p.data;
        }
        return ret;
      }
    }, {
      key: "concat",
      value: function concat(n) {
        if (this.length === 0) return Buffer.alloc(0);
        var ret = Buffer.allocUnsafe(n >>> 0);
        var p = this.head;
        var i = 0;
        while (p) {
          copyBuffer(p.data, ret, i);
          i += p.data.length;
          p = p.next;
        }
        return ret;
      } // Consumes a specified amount of bytes or characters from the buffered data.
    }, {
      key: "consume",
      value: function consume(n, hasStrings) {
        var ret;
        if (n < this.head.data.length) {
          // `slice` is the same for buffers and strings.
          ret = this.head.data.slice(0, n);
          this.head.data = this.head.data.slice(n);
        } else if (n === this.head.data.length) {
          // First chunk is a perfect match.
          ret = this.shift();
        } else {
          // Result spans more than one buffer.
          ret = hasStrings ? this._getString(n) : this._getBuffer(n);
        }
        return ret;
      }
    }, {
      key: "first",
      value: function first() {
        return this.head.data;
      } // Consumes a specified amount of characters from the buffered data.
    }, {
      key: "_getString",
      value: function _getString(n) {
        var p = this.head;
        var c = 1;
        var ret = p.data;
        n -= ret.length;
        while (p = p.next) {
          var str = p.data;
          var nb = n > str.length ? str.length : n;
          if (nb === str.length) ret += str;else ret += str.slice(0, n);
          n -= nb;
          if (n === 0) {
            if (nb === str.length) {
              ++c;
              if (p.next) this.head = p.next;else this.head = this.tail = null;
            } else {
              this.head = p;
              p.data = str.slice(nb);
            }
            break;
          }
          ++c;
        }
        this.length -= c;
        return ret;
      } // Consumes a specified amount of bytes from the buffered data.
    }, {
      key: "_getBuffer",
      value: function _getBuffer(n) {
        var ret = Buffer.allocUnsafe(n);
        var p = this.head;
        var c = 1;
        p.data.copy(ret);
        n -= p.data.length;
        while (p = p.next) {
          var buf = p.data;
          var nb = n > buf.length ? buf.length : n;
          buf.copy(ret, ret.length - n, 0, nb);
          n -= nb;
          if (n === 0) {
            if (nb === buf.length) {
              ++c;
              if (p.next) this.head = p.next;else this.head = this.tail = null;
            } else {
              this.head = p;
              p.data = buf.slice(nb);
            }
            break;
          }
          ++c;
        }
        this.length -= c;
        return ret;
      } // Make sure the linked list only shows the minimal necessary information.
    }, {
      key: custom,
      value: function value(_, options) {
        return inspect(this, _objectSpread({}, options, {
          // Only inspect one level.
          depth: 0,
          // It should not recurse.
          customInspect: false
        }));
      }
    }]);
    return BufferList;
  }();
  return buffer_list;
}

function destroy(err, cb) {
  var _this = this;
  var readableDestroyed = this._readableState && this._readableState.destroyed;
  var writableDestroyed = this._writableState && this._writableState.destroyed;
  if (readableDestroyed || writableDestroyed) {
    if (cb) {
      cb(err);
    } else if (err) {
      if (!this._writableState) {
        browser$1$1.nextTick(emitErrorNT, this, err);
      } else if (!this._writableState.errorEmitted) {
        this._writableState.errorEmitted = true;
        browser$1$1.nextTick(emitErrorNT, this, err);
      }
    }
    return this;
  } // we set destroyed to true before firing error callbacks in order
  // to make it re-entrance safe in case destroy() is called within callbacks

  if (this._readableState) {
    this._readableState.destroyed = true;
  } // if this is a duplex stream mark the writable part as destroyed as well

  if (this._writableState) {
    this._writableState.destroyed = true;
  }
  this._destroy(err || null, function (err) {
    if (!cb && err) {
      if (!_this._writableState) {
        browser$1$1.nextTick(emitErrorAndCloseNT, _this, err);
      } else if (!_this._writableState.errorEmitted) {
        _this._writableState.errorEmitted = true;
        browser$1$1.nextTick(emitErrorAndCloseNT, _this, err);
      } else {
        browser$1$1.nextTick(emitCloseNT, _this);
      }
    } else if (cb) {
      browser$1$1.nextTick(emitCloseNT, _this);
      cb(err);
    } else {
      browser$1$1.nextTick(emitCloseNT, _this);
    }
  });
  return this;
}
function emitErrorAndCloseNT(self, err) {
  emitErrorNT(self, err);
  emitCloseNT(self);
}
function emitCloseNT(self) {
  if (self._writableState && !self._writableState.emitClose) return;
  if (self._readableState && !self._readableState.emitClose) return;
  self.emit('close');
}
function undestroy() {
  if (this._readableState) {
    this._readableState.destroyed = false;
    this._readableState.reading = false;
    this._readableState.ended = false;
    this._readableState.endEmitted = false;
  }
  if (this._writableState) {
    this._writableState.destroyed = false;
    this._writableState.ended = false;
    this._writableState.ending = false;
    this._writableState.finalCalled = false;
    this._writableState.prefinished = false;
    this._writableState.finished = false;
    this._writableState.errorEmitted = false;
  }
}
function emitErrorNT(self, err) {
  self.emit('error', err);
}
function errorOrDestroy$2(stream, err) {
  // We have tests that rely on errors being emitted
  // in the same tick, so changing this is semver major.
  // For now when you opt-in to autoDestroy we allow
  // the error to be emitted nextTick. In a future
  // semver major update we should change the default to this.
  var rState = stream._readableState;
  var wState = stream._writableState;
  if (rState && rState.autoDestroy || wState && wState.autoDestroy) stream.destroy(err);else stream.emit('error', err);
}
var destroy_1 = {
  destroy: destroy,
  undestroy: undestroy,
  errorOrDestroy: errorOrDestroy$2
};

var errorsBrowser = {};

function _inheritsLoose(subClass, superClass) {
  subClass.prototype = Object.create(superClass.prototype);
  subClass.prototype.constructor = subClass;
  subClass.__proto__ = superClass;
}
var codes = {};
function createErrorType(code, message, Base) {
  if (!Base) {
    Base = Error;
  }
  function getMessage(arg1, arg2, arg3) {
    if (typeof message === 'string') {
      return message;
    } else {
      return message(arg1, arg2, arg3);
    }
  }
  var NodeError = /*#__PURE__*/
  function (_Base) {
    _inheritsLoose(NodeError, _Base);
    function NodeError(arg1, arg2, arg3) {
      return _Base.call(this, getMessage(arg1, arg2, arg3)) || this;
    }
    return NodeError;
  }(Base);
  NodeError.prototype.name = Base.name;
  NodeError.prototype.code = code;
  codes[code] = NodeError;
} // https://github.com/nodejs/node/blob/v10.8.0/lib/internal/errors.js

function oneOf(expected, thing) {
  if (Array.isArray(expected)) {
    var len = expected.length;
    expected = expected.map(function (i) {
      return String(i);
    });
    if (len > 2) {
      return "one of ".concat(thing, " ").concat(expected.slice(0, len - 1).join(', '), ", or ") + expected[len - 1];
    } else if (len === 2) {
      return "one of ".concat(thing, " ").concat(expected[0], " or ").concat(expected[1]);
    } else {
      return "of ".concat(thing, " ").concat(expected[0]);
    }
  } else {
    return "of ".concat(thing, " ").concat(String(expected));
  }
} // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith

function startsWith(str, search, pos) {
  return str.substr(!pos || pos < 0 ? 0 : +pos, search.length) === search;
} // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith

function endsWith(str, search, this_len) {
  if (this_len === undefined || this_len > str.length) {
    this_len = str.length;
  }
  return str.substring(this_len - search.length, this_len) === search;
} // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/includes

function includes(str, search, start) {
  if (typeof start !== 'number') {
    start = 0;
  }
  if (start + search.length > str.length) {
    return false;
  } else {
    return str.indexOf(search, start) !== -1;
  }
}
createErrorType('ERR_INVALID_OPT_VALUE', function (name, value) {
  return 'The value "' + value + '" is invalid for option "' + name + '"';
}, TypeError);
createErrorType('ERR_INVALID_ARG_TYPE', function (name, expected, actual) {
  // determiner: 'must be' or 'must not be'
  var determiner;
  if (typeof expected === 'string' && startsWith(expected, 'not ')) {
    determiner = 'must not be';
    expected = expected.replace(/^not /, '');
  } else {
    determiner = 'must be';
  }
  var msg;
  if (endsWith(name, ' argument')) {
    // For cases like 'first argument'
    msg = "The ".concat(name, " ").concat(determiner, " ").concat(oneOf(expected, 'type'));
  } else {
    var type = includes(name, '.') ? 'property' : 'argument';
    msg = "The \"".concat(name, "\" ").concat(type, " ").concat(determiner, " ").concat(oneOf(expected, 'type'));
  }
  msg += ". Received type ".concat(typeof actual);
  return msg;
}, TypeError);
createErrorType('ERR_STREAM_PUSH_AFTER_EOF', 'stream.push() after EOF');
createErrorType('ERR_METHOD_NOT_IMPLEMENTED', function (name) {
  return 'The ' + name + ' method is not implemented';
});
createErrorType('ERR_STREAM_PREMATURE_CLOSE', 'Premature close');
createErrorType('ERR_STREAM_DESTROYED', function (name) {
  return 'Cannot call ' + name + ' after a stream was destroyed';
});
createErrorType('ERR_MULTIPLE_CALLBACK', 'Callback called multiple times');
createErrorType('ERR_STREAM_CANNOT_PIPE', 'Cannot pipe, not readable');
createErrorType('ERR_STREAM_WRITE_AFTER_END', 'write after end');
createErrorType('ERR_STREAM_NULL_VALUES', 'May not write null values to stream', TypeError);
createErrorType('ERR_UNKNOWN_ENCODING', function (arg) {
  return 'Unknown encoding: ' + arg;
}, TypeError);
createErrorType('ERR_STREAM_UNSHIFT_AFTER_END_EVENT', 'stream.unshift() after end event');
errorsBrowser.codes = codes;

var ERR_INVALID_OPT_VALUE = errorsBrowser.codes.ERR_INVALID_OPT_VALUE;
function highWaterMarkFrom(options, isDuplex, duplexKey) {
  return options.highWaterMark != null ? options.highWaterMark : isDuplex ? options[duplexKey] : null;
}
function getHighWaterMark$2(state, options, duplexKey, isDuplex) {
  var hwm = highWaterMarkFrom(options, isDuplex, duplexKey);
  if (hwm != null) {
    if (!(isFinite(hwm) && Math.floor(hwm) === hwm) || hwm < 0) {
      var name = isDuplex ? duplexKey : 'highWaterMark';
      throw new ERR_INVALID_OPT_VALUE(name, hwm);
    }
    return Math.floor(hwm);
  } // Default value

  return state.objectMode ? 16 : 16 * 1024;
}
var state = {
  getHighWaterMark: getHighWaterMark$2
};

var inherits;
if (typeof Object.create === 'function'){
  inherits = function inherits(ctor, superCtor) {
    // implementation from standard node.js 'util' module
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  inherits = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor;
    var TempCtor = function () {};
    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  };
}
var inherits$1 = inherits;

var _polyfillNode_inherits = /*#__PURE__*/Object.freeze({
  __proto__: null,
  default: inherits$1
});

var require$$1 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_inherits);

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var isBufferEncoding = Buffer$2.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     };


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
function StringDecoder$1(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer$2(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
}

// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder$1.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder$1.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder$1.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

var _polyfillNode_string_decoder = /*#__PURE__*/Object.freeze({
  __proto__: null,
  StringDecoder: StringDecoder$1
});

var require$$10 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_string_decoder);

var ERR_STREAM_PREMATURE_CLOSE = errorsBrowser.codes.ERR_STREAM_PREMATURE_CLOSE;
function once$1(callback) {
  var called = false;
  return function () {
    if (called) return;
    called = true;
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    callback.apply(this, args);
  };
}
function noop$1() {}
function isRequest$1(stream) {
  return stream.setHeader && typeof stream.abort === 'function';
}
function eos$1(stream, opts, callback) {
  if (typeof opts === 'function') return eos$1(stream, null, opts);
  if (!opts) opts = {};
  callback = once$1(callback || noop$1);
  var readable = opts.readable || opts.readable !== false && stream.readable;
  var writable = opts.writable || opts.writable !== false && stream.writable;
  var onlegacyfinish = function onlegacyfinish() {
    if (!stream.writable) onfinish();
  };
  var writableEnded = stream._writableState && stream._writableState.finished;
  var onfinish = function onfinish() {
    writable = false;
    writableEnded = true;
    if (!readable) callback.call(stream);
  };
  var readableEnded = stream._readableState && stream._readableState.endEmitted;
  var onend = function onend() {
    readable = false;
    readableEnded = true;
    if (!writable) callback.call(stream);
  };
  var onerror = function onerror(err) {
    callback.call(stream, err);
  };
  var onclose = function onclose() {
    var err;
    if (readable && !readableEnded) {
      if (!stream._readableState || !stream._readableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE();
      return callback.call(stream, err);
    }
    if (writable && !writableEnded) {
      if (!stream._writableState || !stream._writableState.ended) err = new ERR_STREAM_PREMATURE_CLOSE();
      return callback.call(stream, err);
    }
  };
  var onrequest = function onrequest() {
    stream.req.on('finish', onfinish);
  };
  if (isRequest$1(stream)) {
    stream.on('complete', onfinish);
    stream.on('abort', onclose);
    if (stream.req) onrequest();else stream.on('request', onrequest);
  } else if (writable && !stream._writableState) {
    // legacy streams
    stream.on('end', onlegacyfinish);
    stream.on('close', onlegacyfinish);
  }
  stream.on('end', onend);
  stream.on('finish', onfinish);
  if (opts.error !== false) stream.on('error', onerror);
  stream.on('close', onclose);
  return function () {
    stream.removeListener('complete', onfinish);
    stream.removeListener('abort', onclose);
    stream.removeListener('request', onrequest);
    if (stream.req) stream.req.removeListener('finish', onfinish);
    stream.removeListener('end', onlegacyfinish);
    stream.removeListener('close', onlegacyfinish);
    stream.removeListener('finish', onfinish);
    stream.removeListener('end', onend);
    stream.removeListener('error', onerror);
    stream.removeListener('close', onclose);
  };
}
var endOfStream = eos$1;

var async_iterator;
var hasRequiredAsync_iterator;
function requireAsync_iterator() {
  if (hasRequiredAsync_iterator) return async_iterator;
  hasRequiredAsync_iterator = 1;
  var _Object$setPrototypeO;
  function _defineProperty(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }
    return obj;
  }
  var finished = endOfStream;
  var kLastResolve = Symbol('lastResolve');
  var kLastReject = Symbol('lastReject');
  var kError = Symbol('error');
  var kEnded = Symbol('ended');
  var kLastPromise = Symbol('lastPromise');
  var kHandlePromise = Symbol('handlePromise');
  var kStream = Symbol('stream');
  function createIterResult(value, done) {
    return {
      value: value,
      done: done
    };
  }
  function readAndResolve(iter) {
    var resolve = iter[kLastResolve];
    if (resolve !== null) {
      var data = iter[kStream].read(); // we defer if data is null
      // we can be expecting either 'end' or
      // 'error'

      if (data !== null) {
        iter[kLastPromise] = null;
        iter[kLastResolve] = null;
        iter[kLastReject] = null;
        resolve(createIterResult(data, false));
      }
    }
  }
  function onReadable(iter) {
    // we wait for the next tick, because it might
    // emit an error with process.nextTick
    browser$1$1.nextTick(readAndResolve, iter);
  }
  function wrapForNext(lastPromise, iter) {
    return function (resolve, reject) {
      lastPromise.then(function () {
        if (iter[kEnded]) {
          resolve(createIterResult(undefined, true));
          return;
        }
        iter[kHandlePromise](resolve, reject);
      }, reject);
    };
  }
  var AsyncIteratorPrototype = Object.getPrototypeOf(function () {});
  var ReadableStreamAsyncIteratorPrototype = Object.setPrototypeOf((_Object$setPrototypeO = {
    get stream() {
      return this[kStream];
    },
    next: function next() {
      var _this = this;

      // if we have detected an error in the meanwhile
      // reject straight away
      var error = this[kError];
      if (error !== null) {
        return Promise.reject(error);
      }
      if (this[kEnded]) {
        return Promise.resolve(createIterResult(undefined, true));
      }
      if (this[kStream].destroyed) {
        // We need to defer via nextTick because if .destroy(err) is
        // called, the error will be emitted via nextTick, and
        // we cannot guarantee that there is no error lingering around
        // waiting to be emitted.
        return new Promise(function (resolve, reject) {
          browser$1$1.nextTick(function () {
            if (_this[kError]) {
              reject(_this[kError]);
            } else {
              resolve(createIterResult(undefined, true));
            }
          });
        });
      } // if we have multiple next() calls
      // we will wait for the previous Promise to finish
      // this logic is optimized to support for await loops,
      // where next() is only called once at a time

      var lastPromise = this[kLastPromise];
      var promise;
      if (lastPromise) {
        promise = new Promise(wrapForNext(lastPromise, this));
      } else {
        // fast path needed to support multiple this.push()
        // without triggering the next() queue
        var data = this[kStream].read();
        if (data !== null) {
          return Promise.resolve(createIterResult(data, false));
        }
        promise = new Promise(this[kHandlePromise]);
      }
      this[kLastPromise] = promise;
      return promise;
    }
  }, _defineProperty(_Object$setPrototypeO, Symbol.asyncIterator, function () {
    return this;
  }), _defineProperty(_Object$setPrototypeO, "return", function _return() {
    var _this2 = this;

    // destroy(err, cb) is a private API
    // we can guarantee we have that here, because we control the
    // Readable class this is attached to
    return new Promise(function (resolve, reject) {
      _this2[kStream].destroy(null, function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(createIterResult(undefined, true));
      });
    });
  }), _Object$setPrototypeO), AsyncIteratorPrototype);
  var createReadableStreamAsyncIterator = function createReadableStreamAsyncIterator(stream) {
    var _Object$create;
    var iterator = Object.create(ReadableStreamAsyncIteratorPrototype, (_Object$create = {}, _defineProperty(_Object$create, kStream, {
      value: stream,
      writable: true
    }), _defineProperty(_Object$create, kLastResolve, {
      value: null,
      writable: true
    }), _defineProperty(_Object$create, kLastReject, {
      value: null,
      writable: true
    }), _defineProperty(_Object$create, kError, {
      value: null,
      writable: true
    }), _defineProperty(_Object$create, kEnded, {
      value: stream._readableState.endEmitted,
      writable: true
    }), _defineProperty(_Object$create, kHandlePromise, {
      value: function value(resolve, reject) {
        var data = iterator[kStream].read();
        if (data) {
          iterator[kLastPromise] = null;
          iterator[kLastResolve] = null;
          iterator[kLastReject] = null;
          resolve(createIterResult(data, false));
        } else {
          iterator[kLastResolve] = resolve;
          iterator[kLastReject] = reject;
        }
      },
      writable: true
    }), _Object$create));
    iterator[kLastPromise] = null;
    finished(stream, function (err) {
      if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        var reject = iterator[kLastReject]; // reject if we are waiting for data in the Promise
        // returned by next() and store the error

        if (reject !== null) {
          iterator[kLastPromise] = null;
          iterator[kLastResolve] = null;
          iterator[kLastReject] = null;
          reject(err);
        }
        iterator[kError] = err;
        return;
      }
      var resolve = iterator[kLastResolve];
      if (resolve !== null) {
        iterator[kLastPromise] = null;
        iterator[kLastResolve] = null;
        iterator[kLastReject] = null;
        resolve(createIterResult(undefined, true));
      }
      iterator[kEnded] = true;
    });
    stream.on('readable', onReadable.bind(null, iterator));
    return iterator;
  };
  async_iterator = createReadableStreamAsyncIterator;
  return async_iterator;
}

var fromBrowser;
var hasRequiredFromBrowser;
function requireFromBrowser() {
  if (hasRequiredFromBrowser) return fromBrowser;
  hasRequiredFromBrowser = 1;
  fromBrowser = function () {
    throw new Error('Readable.from is not available in the browser');
  };
  return fromBrowser;
}

const Registry$4 = _registry;
Registry$4.Readable = Readable;
Readable.ReadableState = ReadableState;
/*<replacement>*/

require$$1$1.EventEmitter;
var EElistenerCount = function EElistenerCount(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

/*<replacement>*/

var Stream$1 = streamBrowser;
/*</replacement>*/

var Buffer$1 = require$$0.Buffer;
var OurUint8Array$1 = commonjsGlobal.Uint8Array || function () {};
function _uint8ArrayToBuffer$1(chunk) {
  return Buffer$1.from(chunk);
}
function _isUint8Array$1(obj) {
  return Buffer$1.isBuffer(obj) || obj instanceof OurUint8Array$1;
}
/*<replacement>*/

var debugUtil = require$$3;
var debug;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function debug() {};
}
/*</replacement>*/

var BufferList = requireBuffer_list();
var destroyImpl$1 = destroy_1;
var _require$1 = state,
  getHighWaterMark$1 = _require$1.getHighWaterMark;
var _require$codes$3 = errorsBrowser.codes,
  ERR_INVALID_ARG_TYPE$1 = _require$codes$3.ERR_INVALID_ARG_TYPE,
  ERR_STREAM_PUSH_AFTER_EOF = _require$codes$3.ERR_STREAM_PUSH_AFTER_EOF,
  ERR_METHOD_NOT_IMPLEMENTED$2 = _require$codes$3.ERR_METHOD_NOT_IMPLEMENTED,
  ERR_STREAM_UNSHIFT_AFTER_END_EVENT = _require$codes$3.ERR_STREAM_UNSHIFT_AFTER_END_EVENT; // Lazy loaded to improve the startup performance.

var StringDecoder;
var createReadableStreamAsyncIterator;
var from;
require$$1(Readable, Stream$1);
var errorOrDestroy$1 = destroyImpl$1.errorOrDestroy;
var kProxyEvents = ['error', 'close', 'destroy', 'pause', 'resume'];
function prependListener(emitter, event, fn) {
  // Sadly this is not cacheable as some libraries bundle their own
  // event emitter implementation with them.
  if (typeof emitter.prependListener === 'function') return emitter.prependListener(event, fn); // This is a hack to make sure that our error handler is attached before any
  // userland ones.  NEVER DO THIS. This is here only because this code needs
  // to continue to work with older versions of Node.js that do not include
  // the prependListener() method. The goal is to eventually remove this hack.

  if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (Array.isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
}
function ReadableState(options, stream, isDuplex) {
  options = options || {}; // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream.
  // These options can be provided separately as readableXXX and writableXXX.

  if (typeof isDuplex !== 'boolean') isDuplex = stream instanceof Registry$4.Duplex; // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away

  this.objectMode = !!options.objectMode;
  if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode; // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"

  this.highWaterMark = getHighWaterMark$1(this, options, 'readableHighWaterMark', isDuplex); // A linked list is used to store data chunks instead of an array because the
  // linked list can remove elements from the beginning faster than
  // array.shift()

  this.buffer = new BufferList();
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false; // a flag to be able to tell if the event 'readable'/'data' is emitted
  // immediately, or on a later tick.  We set this to true at first, because
  // any actions that shouldn't happen until "later" should generally also
  // not happen before the first read call.

  this.sync = true; // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.

  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;
  this.paused = true; // Should close be emitted on destroy. Defaults to true.

  this.emitClose = options.emitClose !== false; // Should .destroy() be called after 'end' (and potentially 'finish')

  this.autoDestroy = !!options.autoDestroy; // has it been destroyed

  this.destroyed = false; // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.

  this.defaultEncoding = options.defaultEncoding || 'utf8'; // the number of writers that are awaiting a drain event in .pipe()s

  this.awaitDrain = 0; // if true, a maybeReadMore has been scheduled

  this.readingMore = false;
  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder) StringDecoder = require$$10.StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}
function Readable(options) {
  if (!(this instanceof Readable)) return new Readable(options); // Checking for a Stream.Duplex instance is faster here instead of inside
  // the ReadableState constructor, at least with V8 6.5

  var isDuplex = this instanceof Registry$4.Duplex;
  this._readableState = new ReadableState(options, this, isDuplex); // legacy

  this.readable = true;
  if (options) {
    if (typeof options.read === 'function') this._read = options.read;
    if (typeof options.destroy === 'function') this._destroy = options.destroy;
  }
  Stream$1.call(this);
}
Object.defineProperty(Readable.prototype, 'destroyed', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    if (this._readableState === undefined) {
      return false;
    }
    return this._readableState.destroyed;
  },
  set: function set(value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._readableState) {
      return;
    } // backward compatibility, the user is explicitly
    // managing destroyed

    this._readableState.destroyed = value;
  }
});
Readable.prototype.destroy = destroyImpl$1.destroy;
Readable.prototype._undestroy = destroyImpl$1.undestroy;
Readable.prototype._destroy = function (err, cb) {
  cb(err);
}; // Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.

Readable.prototype.push = function (chunk, encoding) {
  var state = this._readableState;
  var skipChunkCheck;
  if (!state.objectMode) {
    if (typeof chunk === 'string') {
      encoding = encoding || state.defaultEncoding;
      if (encoding !== state.encoding) {
        chunk = Buffer$1.from(chunk, encoding);
        encoding = '';
      }
      skipChunkCheck = true;
    }
  } else {
    skipChunkCheck = true;
  }
  return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
}; // Unshift should *always* be something directly out of read()

Readable.prototype.unshift = function (chunk) {
  return readableAddChunk(this, chunk, null, true, false);
};
function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
  debug('readableAddChunk', chunk);
  var state = stream._readableState;
  if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else {
    var er;
    if (!skipChunkCheck) er = chunkInvalid(state, chunk);
    if (er) {
      errorOrDestroy$1(stream, er);
    } else if (state.objectMode || chunk && chunk.length > 0) {
      if (typeof chunk !== 'string' && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer$1.prototype) {
        chunk = _uint8ArrayToBuffer$1(chunk);
      }
      if (addToFront) {
        if (state.endEmitted) errorOrDestroy$1(stream, new ERR_STREAM_UNSHIFT_AFTER_END_EVENT());else addChunk(stream, state, chunk, true);
      } else if (state.ended) {
        errorOrDestroy$1(stream, new ERR_STREAM_PUSH_AFTER_EOF());
      } else if (state.destroyed) {
        return false;
      } else {
        state.reading = false;
        if (state.decoder && !encoding) {
          chunk = state.decoder.write(chunk);
          if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);else maybeReadMore(stream, state);
        } else {
          addChunk(stream, state, chunk, false);
        }
      }
    } else if (!addToFront) {
      state.reading = false;
      maybeReadMore(stream, state);
    }
  } // We can push more data if we are below the highWaterMark.
  // Also, if we have no data yet, we can stand some more bytes.
  // This is to work around cases where hwm=0, such as the repl.

  return !state.ended && (state.length < state.highWaterMark || state.length === 0);
}
function addChunk(stream, state, chunk, addToFront) {
  if (state.flowing && state.length === 0 && !state.sync) {
    state.awaitDrain = 0;
    stream.emit('data', chunk);
  } else {
    // update the buffer info.
    state.length += state.objectMode ? 1 : chunk.length;
    if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);
    if (state.needReadable) emitReadable(stream);
  }
  maybeReadMore(stream, state);
}
function chunkInvalid(state, chunk) {
  var er;
  if (!_isUint8Array$1(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new ERR_INVALID_ARG_TYPE$1('chunk', ['string', 'Buffer', 'Uint8Array'], chunk);
  }
  return er;
}
Readable.prototype.isPaused = function () {
  return this._readableState.flowing === false;
}; // backwards compatibility.

Readable.prototype.setEncoding = function (enc) {
  if (!StringDecoder) StringDecoder = require$$10.StringDecoder;
  var decoder = new StringDecoder(enc);
  this._readableState.decoder = decoder; // If setEncoding(null), decoder.encoding equals utf8

  this._readableState.encoding = this._readableState.decoder.encoding; // Iterate over current buffer to convert already stored Buffers:

  var p = this._readableState.buffer.head;
  var content = '';
  while (p !== null) {
    content += decoder.write(p.data);
    p = p.next;
  }
  this._readableState.buffer.clear();
  if (content !== '') this._readableState.buffer.push(content);
  this._readableState.length = content.length;
  return this;
}; // Don't raise the hwm > 1GB

var MAX_HWM = 0x40000000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    // TODO(ronag): Throw ERR_VALUE_OUT_OF_RANGE.
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2 to prevent increasing hwm excessively in
    // tiny amounts
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
} // This function is designed to be inlinable, so please take care when making
// changes to the function body.

function howMuchToRead(n, state) {
  if (n <= 0 || state.length === 0 && state.ended) return 0;
  if (state.objectMode) return 1;
  if (n !== n) {
    // Only flow one buffer at a time
    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
  } // If we're asking for more than the current hwm, then raise the hwm.

  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
  if (n <= state.length) return n; // Don't have enough

  if (!state.ended) {
    state.needReadable = true;
    return 0;
  }
  return state.length;
} // you can override either this method, or the async _read(n) below.

Readable.prototype.read = function (n) {
  debug('read', n);
  n = parseInt(n, 10);
  var state = this._readableState;
  var nOrig = n;
  if (n !== 0) state.emittedReadable = false; // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.

  if (n === 0 && state.needReadable && ((state.highWaterMark !== 0 ? state.length >= state.highWaterMark : state.length > 0) || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
    return null;
  }
  n = howMuchToRead(n, state); // if we've ended, and we're now clear, then finish it up.

  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this);
    return null;
  } // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.
  // if we need a readable event, then we need to do some reading.

  var doRead = state.needReadable;
  debug('need readable', doRead); // if we currently have less than the highWaterMark, then also read some

  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  } // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.

  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  } else if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true; // if the length is currently zero, then we *need* a readable event.

    if (state.length === 0) state.needReadable = true; // call internal read method

    this._read(state.highWaterMark);
    state.sync = false; // If _read pushed data synchronously, then `reading` will be false,
    // and we need to re-evaluate how much data we can return to the user.

    if (!state.reading) n = howMuchToRead(nOrig, state);
  }
  var ret;
  if (n > 0) ret = fromList(n, state);else ret = null;
  if (ret === null) {
    state.needReadable = state.length <= state.highWaterMark;
    n = 0;
  } else {
    state.length -= n;
    state.awaitDrain = 0;
  }
  if (state.length === 0) {
    // If we have nothing in the buffer, then we want to know
    // as soon as we *do* get something into the buffer.
    if (!state.ended) state.needReadable = true; // If we tried to read() past the EOF, then emit end on the next tick.

    if (nOrig !== n && state.ended) endReadable(this);
  }
  if (ret !== null) this.emit('data', ret);
  return ret;
};
function onEofChunk(stream, state) {
  debug('onEofChunk');
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;
  if (state.sync) {
    // if we are sync, wait until next tick to emit the data.
    // Otherwise we risk emitting data in the flow()
    // the readable code triggers during a read() call
    emitReadable(stream);
  } else {
    // emit 'readable' now to make sure it gets picked up.
    state.needReadable = false;
    if (!state.emittedReadable) {
      state.emittedReadable = true;
      emitReadable_(stream);
    }
  }
} // Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.

function emitReadable(stream) {
  var state = stream._readableState;
  debug('emitReadable', state.needReadable, state.emittedReadable);
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    browser$1$1.nextTick(emitReadable_, stream);
  }
}
function emitReadable_(stream) {
  var state = stream._readableState;
  debug('emitReadable_', state.destroyed, state.length, state.ended);
  if (!state.destroyed && (state.length || state.ended)) {
    stream.emit('readable');
    state.emittedReadable = false;
  } // The stream needs another readable event if
  // 1. It is not flowing, as the flow mechanism will take
  //    care of it.
  // 2. It is not ended.
  // 3. It is below the highWaterMark, so we can schedule
  //    another readable later.

  state.needReadable = !state.flowing && !state.ended && state.length <= state.highWaterMark;
  flow(stream);
} // at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.

function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    browser$1$1.nextTick(maybeReadMore_, stream, state);
  }
}
function maybeReadMore_(stream, state) {
  // Attempt to read more data if we should.
  //
  // The conditions for reading more data are (one of):
  // - Not enough data buffered (state.length < state.highWaterMark). The loop
  //   is responsible for filling the buffer with enough data if such data
  //   is available. If highWaterMark is 0 and we are not in the flowing mode
  //   we should _not_ attempt to buffer any extra data. We'll get more data
  //   when the stream consumer calls read() instead.
  // - No data in the buffer, and the stream is in flowing mode. In this mode
  //   the loop below is responsible for ensuring read() is called. Failing to
  //   call read here would abort the flow and there's no other mechanism for
  //   continuing the flow if the stream consumer has just subscribed to the
  //   'data' event.
  //
  // In addition to the above conditions to keep reading data, the following
  // conditions prevent the data from being read:
  // - The stream has ended (state.ended).
  // - There is already a pending 'read' operation (state.reading). This is a
  //   case where the the stream has called the implementation defined _read()
  //   method, but they are processing the call asynchronously and have _not_
  //   called push() with new data. In this case we skip performing more
  //   read()s. The execution ends in this method again after the _read() ends
  //   up calling push() with more data.
  while (!state.reading && !state.ended && (state.length < state.highWaterMark || state.flowing && state.length === 0)) {
    var len = state.length;
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
  }
  state.readingMore = false;
} // abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.

Readable.prototype._read = function (n) {
  errorOrDestroy$1(this, new ERR_METHOD_NOT_IMPLEMENTED$2('_read()'));
};
Readable.prototype.pipe = function (dest, pipeOpts) {
  var src = this;
  var state = this._readableState;
  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);
  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== browser$1$1.stdout && dest !== browser$1$1.stderr;
  var endFn = doEnd ? onend : unpipe;
  if (state.endEmitted) browser$1$1.nextTick(endFn);else src.once('end', endFn);
  dest.on('unpipe', onunpipe);
  function onunpipe(readable, unpipeInfo) {
    debug('onunpipe');
    if (readable === src) {
      if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
        unpipeInfo.hasUnpiped = true;
        cleanup();
      }
    }
  }
  function onend() {
    debug('onend');
    dest.end();
  } // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.

  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);
  var cleanedUp = false;
  function cleanup() {
    debug('cleanup'); // cleanup event handlers once the pipe is broken

    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', unpipe);
    src.removeListener('data', ondata);
    cleanedUp = true; // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.

    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  }
  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    var ret = dest.write(chunk);
    debug('dest.write', ret);
    if (ret === false) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      // => Check whether `dest` is still a piping destination.
      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
        debug('false write response, pause', state.awaitDrain);
        state.awaitDrain++;
      }
      src.pause();
    }
  } // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.

  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0) errorOrDestroy$1(dest, er);
  } // Make sure our error handler is attached before userland ones.

  prependListener(dest, 'error', onerror); // Both close and finish should trigger unpipe, but only once.

  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);
  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  } // tell the dest that it's being piped to

  dest.emit('pipe', src); // start the flow if it hasn't been started already.

  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }
  return dest;
};
function pipeOnDrain(src) {
  return function pipeOnDrainFunctionResult() {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain) state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}
Readable.prototype.unpipe = function (dest) {
  var state = this._readableState;
  var unpipeInfo = {
    hasUnpiped: false
  }; // if we're not piping anywhere, then do nothing.

  if (state.pipesCount === 0) return this; // just one destination.  most common case.

  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes) return this;
    if (!dest) dest = state.pipes; // got a match.

    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest) dest.emit('unpipe', this, unpipeInfo);
    return this;
  } // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    for (var i = 0; i < len; i++) {
      dests[i].emit('unpipe', this, {
        hasUnpiped: false
      });
    }
    return this;
  } // try to find the right one.

  var index = indexOf(state.pipes, dest);
  if (index === -1) return this;
  state.pipes.splice(index, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1) state.pipes = state.pipes[0];
  dest.emit('unpipe', this, unpipeInfo);
  return this;
}; // set up data events if they are asked for
// Ensure readable listeners eventually get something

Readable.prototype.on = function (ev, fn) {
  var res = Stream$1.prototype.on.call(this, ev, fn);
  var state = this._readableState;
  if (ev === 'data') {
    // update readableListening so that resume() may be a no-op
    // a few lines down. This is needed to support once('readable').
    state.readableListening = this.listenerCount('readable') > 0; // Try start flowing on next tick if stream isn't explicitly paused

    if (state.flowing !== false) this.resume();
  } else if (ev === 'readable') {
    if (!state.endEmitted && !state.readableListening) {
      state.readableListening = state.needReadable = true;
      state.flowing = false;
      state.emittedReadable = false;
      debug('on readable', state.length, state.reading);
      if (state.length) {
        emitReadable(this);
      } else if (!state.reading) {
        browser$1$1.nextTick(nReadingNextTick, this);
      }
    }
  }
  return res;
};
Readable.prototype.addListener = Readable.prototype.on;
Readable.prototype.removeListener = function (ev, fn) {
  var res = Stream$1.prototype.removeListener.call(this, ev, fn);
  if (ev === 'readable') {
    // We need to check if there is someone still listening to
    // readable and reset the state. However this needs to happen
    // after readable has been emitted but before I/O (nextTick) to
    // support once('readable', fn) cycles. This means that calling
    // resume within the same tick will have no
    // effect.
    browser$1$1.nextTick(updateReadableListening, this);
  }
  return res;
};
Readable.prototype.removeAllListeners = function (ev) {
  var res = Stream$1.prototype.removeAllListeners.apply(this, arguments);
  if (ev === 'readable' || ev === undefined) {
    // We need to check if there is someone still listening to
    // readable and reset the state. However this needs to happen
    // after readable has been emitted but before I/O (nextTick) to
    // support once('readable', fn) cycles. This means that calling
    // resume within the same tick will have no
    // effect.
    browser$1$1.nextTick(updateReadableListening, this);
  }
  return res;
};
function updateReadableListening(self) {
  var state = self._readableState;
  state.readableListening = self.listenerCount('readable') > 0;
  if (state.resumeScheduled && !state.paused) {
    // flowing needs to be set to true now, otherwise
    // the upcoming resume will not flow.
    state.flowing = true; // crude way to check if we should resume
  } else if (self.listenerCount('data') > 0) {
    self.resume();
  }
}
function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
} // pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.

Readable.prototype.resume = function () {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume'); // we flow only if there is no one listening
    // for readable, but we still have to call
    // resume()

    state.flowing = !state.readableListening;
    resume(this, state);
  }
  state.paused = false;
  return this;
};
function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    browser$1$1.nextTick(resume_, stream, state);
  }
}
function resume_(stream, state) {
  debug('resume', state.reading);
  if (!state.reading) {
    stream.read(0);
  }
  state.resumeScheduled = false;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading) stream.read(0);
}
Readable.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (this._readableState.flowing !== false) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  this._readableState.paused = true;
  return this;
};
function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  while (state.flowing && stream.read() !== null) {
  }
} // wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.

Readable.prototype.wrap = function (stream) {
  var _this = this;
  var state = this._readableState;
  var paused = false;
  stream.on('end', function () {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) _this.push(chunk);
    }
    _this.push(null);
  });
  stream.on('data', function (chunk) {
    debug('wrapped data');
    if (state.decoder) chunk = state.decoder.write(chunk); // don't skip over falsy values in objectMode

    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;
    var ret = _this.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  }); // proxy all the other methods.
  // important when wrapping filters and duplexes.

  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function methodWrap(method) {
        return function methodWrapReturnFunction() {
          return stream[method].apply(stream, arguments);
        };
      }(i);
    }
  } // proxy certain important events.

  for (var n = 0; n < kProxyEvents.length; n++) {
    stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
  } // when we try to consume some more bytes, simply unpause the
  // underlying stream.

  this._read = function (n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };
  return this;
};
if (typeof Symbol === 'function') {
  Readable.prototype[Symbol.asyncIterator] = function () {
    if (createReadableStreamAsyncIterator === undefined) {
      createReadableStreamAsyncIterator = requireAsync_iterator();
    }
    return createReadableStreamAsyncIterator(this);
  };
}
Object.defineProperty(Readable.prototype, 'readableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._readableState.highWaterMark;
  }
});
Object.defineProperty(Readable.prototype, 'readableBuffer', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._readableState && this._readableState.buffer;
  }
});
Object.defineProperty(Readable.prototype, 'readableFlowing', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._readableState.flowing;
  },
  set: function set(state) {
    if (this._readableState) {
      this._readableState.flowing = state;
    }
  }
}); // exposed for testing purposes only.

Readable._fromList = fromList;
Object.defineProperty(Readable.prototype, 'readableLength', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._readableState.length;
  }
}); // Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.

function fromList(n, state) {
  // nothing buffered
  if (state.length === 0) return null;
  var ret;
  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
    // read it all, truncate the list
    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.first();else ret = state.buffer.concat(state.length);
    state.buffer.clear();
  } else {
    // read part of list
    ret = state.buffer.consume(n, state.decoder);
  }
  return ret;
}
function endReadable(stream) {
  var state = stream._readableState;
  debug('endReadable', state.endEmitted);
  if (!state.endEmitted) {
    state.ended = true;
    browser$1$1.nextTick(endReadableNT, state, stream);
  }
}
function endReadableNT(state, stream) {
  debug('endReadableNT', state.endEmitted, state.length); // Check that we didn't get one last unshift.

  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
    if (state.autoDestroy) {
      // In case of duplex streams we need a way to detect
      // if the writable side is ready for autoDestroy as well
      var wState = stream._writableState;
      if (!wState || wState.autoDestroy && wState.finished) {
        stream.destroy();
      }
    }
  }
}
if (typeof Symbol === 'function') {
  Readable.from = function (iterable, opts) {
    if (from === undefined) {
      from = requireFromBrowser();
    }
    return from(Readable, iterable, opts);
  };
}
function indexOf(xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

/**
 * Module exports.
 */

var browser = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate(fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }
  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }
  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config(name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!commonjsGlobal.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = commonjsGlobal.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

const Registry$3 = _registry;
Registry$3.Writable = Writable;
// there will be only 2 of these for each stream

function CorkedRequest(state) {
  var _this = this;
  this.next = null;
  this.entry = null;
  this.finish = function () {
    onCorkedFinish(_this, state);
  };
}
/* </replacement> */

/*<replacement>*/

/*</replacement>*/

Writable.WritableState = WritableState;
/*<replacement>*/

var internalUtil = {
  deprecate: browser
};
/*</replacement>*/

/*<replacement>*/

var Stream = streamBrowser;
/*</replacement>*/

var Buffer = require$$0.Buffer;
var OurUint8Array = commonjsGlobal.Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}
var destroyImpl = destroy_1;
var _require = state,
  getHighWaterMark = _require.getHighWaterMark;
var _require$codes$2 = errorsBrowser.codes,
  ERR_INVALID_ARG_TYPE = _require$codes$2.ERR_INVALID_ARG_TYPE,
  ERR_METHOD_NOT_IMPLEMENTED$1 = _require$codes$2.ERR_METHOD_NOT_IMPLEMENTED,
  ERR_MULTIPLE_CALLBACK$1 = _require$codes$2.ERR_MULTIPLE_CALLBACK,
  ERR_STREAM_CANNOT_PIPE = _require$codes$2.ERR_STREAM_CANNOT_PIPE,
  ERR_STREAM_DESTROYED$1 = _require$codes$2.ERR_STREAM_DESTROYED,
  ERR_STREAM_NULL_VALUES = _require$codes$2.ERR_STREAM_NULL_VALUES,
  ERR_STREAM_WRITE_AFTER_END = _require$codes$2.ERR_STREAM_WRITE_AFTER_END,
  ERR_UNKNOWN_ENCODING = _require$codes$2.ERR_UNKNOWN_ENCODING;
var errorOrDestroy = destroyImpl.errorOrDestroy;
require$$1(Writable, Stream);
function nop() {}
function WritableState(options, stream, isDuplex) {
  options = options || {}; // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream,
  // e.g. options.readableObjectMode vs. options.writableObjectMode, etc.

  if (typeof isDuplex !== 'boolean') isDuplex = stream instanceof Registry$3.Duplex; // object stream flag to indicate whether or not this stream
  // contains buffers or objects.

  this.objectMode = !!options.objectMode;
  if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode; // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()

  this.highWaterMark = getHighWaterMark(this, options, 'writableHighWaterMark', isDuplex); // if _final has been called

  this.finalCalled = false; // drain event flag.

  this.needDrain = false; // at the start of calling end()

  this.ending = false; // when end() has been called, and returned

  this.ended = false; // when 'finish' is emitted

  this.finished = false; // has it been destroyed

  this.destroyed = false; // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.

  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode; // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.

  this.defaultEncoding = options.defaultEncoding || 'utf8'; // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.

  this.length = 0; // a flag to see when we're in the middle of a write.

  this.writing = false; // when true all writes will be buffered until .uncork() call

  this.corked = 0; // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.

  this.sync = true; // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.

  this.bufferProcessing = false; // the callback that's passed to _write(chunk,cb)

  this.onwrite = function (er) {
    onwrite(stream, er);
  }; // the callback that the user supplies to write(chunk,encoding,cb)

  this.writecb = null; // the amount that is being written when _write is called.

  this.writelen = 0;
  this.bufferedRequest = null;
  this.lastBufferedRequest = null; // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted

  this.pendingcb = 0; // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams

  this.prefinished = false; // True if the error was already emitted and should not be thrown again

  this.errorEmitted = false; // Should close be emitted on destroy. Defaults to true.

  this.emitClose = options.emitClose !== false; // Should .destroy() be called after 'finish' (and potentially 'end')

  this.autoDestroy = !!options.autoDestroy; // count buffered requests

  this.bufferedRequestCount = 0; // allocate the first CorkedRequest, there is always
  // one allocated and free to use, and we maintain at most two

  this.corkedRequestsFree = new CorkedRequest(this);
}
WritableState.prototype.getBuffer = function getBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};
(function () {
  try {
    Object.defineProperty(WritableState.prototype, 'buffer', {
      get: internalUtil.deprecate(function writableStateBufferGetter() {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.', 'DEP0003')
    });
  } catch (_) {}
})(); // Test _writableState for inheritance to account for Duplex streams,
// whose prototype chain only points to Readable.

var realHasInstance;
if (typeof Symbol === 'function' && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === 'function') {
  realHasInstance = Function.prototype[Symbol.hasInstance];
  Object.defineProperty(Writable, Symbol.hasInstance, {
    value: function value(object) {
      if (realHasInstance.call(this, object)) return true;
      if (this !== Writable) return false;
      return object && object._writableState instanceof WritableState;
    }
  });
} else {
  realHasInstance = function realHasInstance(object) {
    return object instanceof this;
  };
}
function Writable(options) {
  // Writable ctor is applied to Duplexes, too.
  // `realHasInstance` is necessary because using plain `instanceof`
  // would return false, as no `_writableState` property is attached.
  // Trying to use the custom `instanceof` for Writable here will also break the
  // Node.js LazyTransform implementation, which has a non-trivial getter for
  // `_writableState` that would lead to infinite recursion.
  // Checking for a Stream.Duplex instance is faster here instead of inside
  // the WritableState constructor, at least with V8 6.5

  var isDuplex = this instanceof Registry$3.Duplex;
  if (!isDuplex && !realHasInstance.call(Writable, this)) return new Writable(options);
  this._writableState = new WritableState(options, this, isDuplex); // legacy.

  this.writable = true;
  if (options) {
    if (typeof options.write === 'function') this._write = options.write;
    if (typeof options.writev === 'function') this._writev = options.writev;
    if (typeof options.destroy === 'function') this._destroy = options.destroy;
    if (typeof options.final === 'function') this._final = options.final;
  }
  Stream.call(this);
} // Otherwise people can pipe Writable streams, which is just wrong.

Writable.prototype.pipe = function () {
  errorOrDestroy(this, new ERR_STREAM_CANNOT_PIPE());
};
function writeAfterEnd(stream, cb) {
  var er = new ERR_STREAM_WRITE_AFTER_END(); // TODO: defer error events consistently everywhere, not just the cb

  errorOrDestroy(stream, er);
  browser$1$1.nextTick(cb, er);
} // Checks that a user-supplied chunk is valid, especially for the particular
// mode the stream is in. Currently this means that `null` is never accepted
// and undefined/non-string values are only allowed in object mode.

function validChunk(stream, state, chunk, cb) {
  var er;
  if (chunk === null) {
    er = new ERR_STREAM_NULL_VALUES();
  } else if (typeof chunk !== 'string' && !state.objectMode) {
    er = new ERR_INVALID_ARG_TYPE('chunk', ['string', 'Buffer'], chunk);
  }
  if (er) {
    errorOrDestroy(stream, er);
    browser$1$1.nextTick(cb, er);
    return false;
  }
  return true;
}
Writable.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;
  var isBuf = !state.objectMode && _isUint8Array(chunk);
  if (isBuf && !Buffer.isBuffer(chunk)) {
    chunk = _uint8ArrayToBuffer(chunk);
  }
  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }
  if (isBuf) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;
  if (typeof cb !== 'function') cb = nop;
  if (state.ending) writeAfterEnd(this, cb);else if (isBuf || validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
  }
  return ret;
};
Writable.prototype.cork = function () {
  this._writableState.corked++;
};
Writable.prototype.uncork = function () {
  var state = this._writableState;
  if (state.corked) {
    state.corked--;
    if (!state.writing && !state.corked && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  }
};
Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new ERR_UNKNOWN_ENCODING(encoding);
  this._writableState.defaultEncoding = encoding;
  return this;
};
Object.defineProperty(Writable.prototype, 'writableBuffer', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._writableState && this._writableState.getBuffer();
  }
});
function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
    chunk = Buffer.from(chunk, encoding);
  }
  return chunk;
}
Object.defineProperty(Writable.prototype, 'writableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._writableState.highWaterMark;
  }
}); // if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.

function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
  if (!isBuf) {
    var newChunk = decodeChunk(state, chunk, encoding);
    if (chunk !== newChunk) {
      isBuf = true;
      encoding = 'buffer';
      chunk = newChunk;
    }
  }
  var len = state.objectMode ? 1 : chunk.length;
  state.length += len;
  var ret = state.length < state.highWaterMark; // we must ensure that previous needDrain will not be reset to false.

  if (!ret) state.needDrain = true;
  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = {
      chunk: chunk,
      encoding: encoding,
      isBuf: isBuf,
      callback: cb,
      next: null
    };
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }
  return ret;
}
function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (state.destroyed) state.onwrite(new ERR_STREAM_DESTROYED$1('write'));else if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}
function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;
  if (sync) {
    // defer the callback if we are being called synchronously
    // to avoid piling up things on the stack
    browser$1$1.nextTick(cb, er); // this can emit finish, and it will always happen
    // after error

    browser$1$1.nextTick(finishMaybe, stream, state);
    stream._writableState.errorEmitted = true;
    errorOrDestroy(stream, er);
  } else {
    // the caller expect this to happen before if
    // it is async
    cb(er);
    stream._writableState.errorEmitted = true;
    errorOrDestroy(stream, er); // this can emit finish, but finish must
    // always follow error

    finishMaybe(stream, state);
  }
}
function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}
function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;
  if (typeof cb !== 'function') throw new ERR_MULTIPLE_CALLBACK$1();
  onwriteStateUpdate(state);
  if (er) onwriteError(stream, state, sync, er, cb);else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state) || stream.destroyed;
    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
      clearBuffer(stream, state);
    }
    if (sync) {
      browser$1$1.nextTick(afterWrite, stream, state, finished, cb);
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}
function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
} // Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.

function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
} // if there's something in the buffer waiting, then process it

function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;
  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var l = state.bufferedRequestCount;
    var buffer = new Array(l);
    var holder = state.corkedRequestsFree;
    holder.entry = entry;
    var count = 0;
    var allBuffers = true;
    while (entry) {
      buffer[count] = entry;
      if (!entry.isBuf) allBuffers = false;
      entry = entry.next;
      count += 1;
    }
    buffer.allBuffers = allBuffers;
    doWrite(stream, state, true, state.length, buffer, '', holder.finish); // doWrite is almost always async, defer these to save a bit of time
    // as the hot path ends with doWrite

    state.pendingcb++;
    state.lastBufferedRequest = null;
    if (holder.next) {
      state.corkedRequestsFree = holder.next;
      holder.next = null;
    } else {
      state.corkedRequestsFree = new CorkedRequest(state);
    }
    state.bufferedRequestCount = 0;
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;
      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      state.bufferedRequestCount--; // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.

      if (state.writing) {
        break;
      }
    }
    if (entry === null) state.lastBufferedRequest = null;
  }
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}
Writable.prototype._write = function (chunk, encoding, cb) {
  cb(new ERR_METHOD_NOT_IMPLEMENTED$1('_write()'));
};
Writable.prototype._writev = null;
Writable.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState;
  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }
  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding); // .end() fully uncorks

  if (state.corked) {
    state.corked = 1;
    this.uncork();
  } // ignore unnecessary end() calls.

  if (!state.ending) endWritable(this, state, cb);
  return this;
};
Object.defineProperty(Writable.prototype, 'writableLength', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._writableState.length;
  }
});
function needFinish(state) {
  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
}
function callFinal(stream, state) {
  stream._final(function (err) {
    state.pendingcb--;
    if (err) {
      errorOrDestroy(stream, err);
    }
    state.prefinished = true;
    stream.emit('prefinish');
    finishMaybe(stream, state);
  });
}
function prefinish$1(stream, state) {
  if (!state.prefinished && !state.finalCalled) {
    if (typeof stream._final === 'function' && !state.destroyed) {
      state.pendingcb++;
      state.finalCalled = true;
      browser$1$1.nextTick(callFinal, stream, state);
    } else {
      state.prefinished = true;
      stream.emit('prefinish');
    }
  }
}
function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    prefinish$1(stream, state);
    if (state.pendingcb === 0) {
      state.finished = true;
      stream.emit('finish');
      if (state.autoDestroy) {
        // In case of duplex streams we need a way to detect
        // if the readable side is ready for autoDestroy as well
        var rState = stream._readableState;
        if (!rState || rState.autoDestroy && rState.endEmitted) {
          stream.destroy();
        }
      }
    }
  }
  return need;
}
function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished) browser$1$1.nextTick(cb);else stream.once('finish', cb);
  }
  state.ended = true;
  stream.writable = false;
}
function onCorkedFinish(corkReq, state, err) {
  var entry = corkReq.entry;
  corkReq.entry = null;
  while (entry) {
    var cb = entry.callback;
    state.pendingcb--;
    cb(err);
    entry = entry.next;
  } // reuse the free corkReq.

  state.corkedRequestsFree.next = corkReq;
}
Object.defineProperty(Writable.prototype, 'destroyed', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    if (this._writableState === undefined) {
      return false;
    }
    return this._writableState.destroyed;
  },
  set: function set(value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._writableState) {
      return;
    } // backward compatibility, the user is explicitly
    // managing destroyed

    this._writableState.destroyed = value;
  }
});
Writable.prototype.destroy = destroyImpl.destroy;
Writable.prototype._undestroy = destroyImpl.undestroy;
Writable.prototype._destroy = function (err, cb) {
  cb(err);
};

/*<replacement>*/

var objectKeys$1 = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }
  return keys;
};
/*</replacement>*/

const Registry$2 = _registry;
Registry$2.Duplex = Duplex;
require$$1(Duplex, Registry$2.Readable);
{
  // Allow the keys array to be GC'ed.
  var keys = objectKeys$1(Registry$2.Writable.prototype);
  for (var v = 0; v < keys.length; v++) {
    var method = keys[v];
    if (!Duplex.prototype[method]) Duplex.prototype[method] = Registry$2.Writable.prototype[method];
  }
}
function Duplex(options) {
  if (!(this instanceof Duplex)) return new Duplex(options);
  Registry$2.Readable.call(this, options);
  Registry$2.Writable.call(this, options);
  this.allowHalfOpen = true;
  if (options) {
    if (options.readable === false) this.readable = false;
    if (options.writable === false) this.writable = false;
    if (options.allowHalfOpen === false) {
      this.allowHalfOpen = false;
      this.once('end', onend);
    }
  }
}
Object.defineProperty(Duplex.prototype, 'writableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._writableState.highWaterMark;
  }
});
Object.defineProperty(Duplex.prototype, 'writableBuffer', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._writableState && this._writableState.getBuffer();
  }
});
Object.defineProperty(Duplex.prototype, 'writableLength', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    return this._writableState.length;
  }
}); // the no-half-open enforcer

function onend() {
  // If the writable side ended, then we're ok.
  if (this._writableState.ended) return; // no more data can be written.
  // But allow more writes to happen in this tick.

  browser$1$1.nextTick(onEndNT, this);
}
function onEndNT(self) {
  self.end();
}
Object.defineProperty(Duplex.prototype, 'destroyed', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function get() {
    if (this._readableState === undefined || this._writableState === undefined) {
      return false;
    }
    return this._readableState.destroyed && this._writableState.destroyed;
  },
  set: function set(value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (this._readableState === undefined || this._writableState === undefined) {
      return;
    } // backward compatibility, the user is explicitly
    // managing destroyed

    this._readableState.destroyed = value;
    this._writableState.destroyed = value;
  }
});

const Registry$1 = _registry;
Registry$1.Transform = Transform$1;
var _require$codes$1 = errorsBrowser.codes,
  ERR_METHOD_NOT_IMPLEMENTED = _require$codes$1.ERR_METHOD_NOT_IMPLEMENTED,
  ERR_MULTIPLE_CALLBACK = _require$codes$1.ERR_MULTIPLE_CALLBACK,
  ERR_TRANSFORM_ALREADY_TRANSFORMING = _require$codes$1.ERR_TRANSFORM_ALREADY_TRANSFORMING,
  ERR_TRANSFORM_WITH_LENGTH_0 = _require$codes$1.ERR_TRANSFORM_WITH_LENGTH_0;
require$$1(Transform$1, Registry$1.Duplex);
function afterTransform(er, data) {
  var ts = this._transformState;
  ts.transforming = false;
  var cb = ts.writecb;
  if (cb === null) {
    return this.emit('error', new ERR_MULTIPLE_CALLBACK());
  }
  ts.writechunk = null;
  ts.writecb = null;
  if (data != null)
    // single equals check for both `null` and `undefined`
    this.push(data);
  cb(er);
  var rs = this._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    this._read(rs.highWaterMark);
  }
}
function Transform$1(options) {
  if (!(this instanceof Transform$1)) return new Transform$1(options);
  Registry$1.Duplex.call(this, options);
  this._transformState = {
    afterTransform: afterTransform.bind(this),
    needTransform: false,
    transforming: false,
    writecb: null,
    writechunk: null,
    writeencoding: null
  }; // start out asking for a readable event once data is transformed.

  this._readableState.needReadable = true; // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.

  this._readableState.sync = false;
  if (options) {
    if (typeof options.transform === 'function') this._transform = options.transform;
    if (typeof options.flush === 'function') this._flush = options.flush;
  } // When the writable side finishes, then flush out anything remaining.

  this.on('prefinish', prefinish);
}
function prefinish() {
  var _this = this;
  if (typeof this._flush === 'function' && !this._readableState.destroyed) {
    this._flush(function (er, data) {
      done(_this, er, data);
    });
  } else {
    done(this, null, null);
  }
}
Transform$1.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false;
  return Registry$1.Duplex.prototype.push.call(this, chunk, encoding);
}; // This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.

Transform$1.prototype._transform = function (chunk, encoding, cb) {
  cb(new ERR_METHOD_NOT_IMPLEMENTED('_transform()'));
};
Transform$1.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  }
}; // Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.

Transform$1.prototype._read = function (n) {
  var ts = this._transformState;
  if (ts.writechunk !== null && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};
Transform$1.prototype._destroy = function (err, cb) {
  Registry$1.Duplex.prototype._destroy.call(this, err, function (err2) {
    cb(err2);
  });
};
function done(stream, er, data) {
  if (er) return stream.emit('error', er);
  if (data != null)
    // single equals check for both `null` and `undefined`
    stream.push(data); // TODO(BridgeAR): Write a test for these two error cases
  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided

  if (stream._writableState.length) throw new ERR_TRANSFORM_WITH_LENGTH_0();
  if (stream._transformState.transforming) throw new ERR_TRANSFORM_ALREADY_TRANSFORMING();
  return stream.push(null);
}

const Registry = _registry;
Registry.PassThrough = PassThrough;
require$$1(PassThrough, Registry.Transform);
function PassThrough(options) {
  if (!(this instanceof PassThrough)) return new PassThrough(options);
  Transform.call(this, options);
}
PassThrough.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk);
};

var eos;
function once(callback) {
  var called = false;
  return function () {
    if (called) return;
    called = true;
    callback.apply(void 0, arguments);
  };
}
var _require$codes = errorsBrowser.codes,
  ERR_MISSING_ARGS = _require$codes.ERR_MISSING_ARGS,
  ERR_STREAM_DESTROYED = _require$codes.ERR_STREAM_DESTROYED;
function noop(err) {
  // Rethrow the error if it exists to avoid swallowing it
  if (err) throw err;
}
function isRequest(stream) {
  return stream.setHeader && typeof stream.abort === 'function';
}
function destroyer(stream, reading, writing, callback) {
  callback = once(callback);
  var closed = false;
  stream.on('close', function () {
    closed = true;
  });
  if (eos === undefined) eos = endOfStream;
  eos(stream, {
    readable: reading,
    writable: writing
  }, function (err) {
    if (err) return callback(err);
    closed = true;
    callback();
  });
  var destroyed = false;
  return function (err) {
    if (closed) return;
    if (destroyed) return;
    destroyed = true; // request.destroy just do .end - .abort is what we want

    if (isRequest(stream)) return stream.abort();
    if (typeof stream.destroy === 'function') return stream.destroy();
    callback(err || new ERR_STREAM_DESTROYED('pipe'));
  };
}
function call(fn) {
  fn();
}
function pipe(from, to) {
  return from.pipe(to);
}
function popCallback(streams) {
  if (!streams.length) return noop;
  if (typeof streams[streams.length - 1] !== 'function') return noop;
  return streams.pop();
}
function pipeline() {
  for (var _len = arguments.length, streams = new Array(_len), _key = 0; _key < _len; _key++) {
    streams[_key] = arguments[_key];
  }
  var callback = popCallback(streams);
  if (Array.isArray(streams[0])) streams = streams[0];
  if (streams.length < 2) {
    throw new ERR_MISSING_ARGS('streams');
  }
  var error;
  var destroys = streams.map(function (stream, i) {
    var reading = i < streams.length - 1;
    var writing = i > 0;
    return destroyer(stream, reading, writing, function (err) {
      if (!error) error = err;
      if (err) destroys.forEach(call);
      if (reading) return;
      destroys.forEach(call);
      callback(error);
    });
  });
  return streams.reduce(pipe);
}
var pipeline_1 = pipeline;

(function (module, exports) {
  const Registry = _registry;
  exports = module.exports = Registry.Readable;
  exports.Stream = Registry.Readable;
  exports.Readable = Registry.Readable;
  exports.Writable = Registry.Writable;
  exports.Duplex = Registry.Duplex;
  exports.Transform = Registry.Transform;
  exports.PassThrough = Registry.PassThrough;
  exports.finished = endOfStream;
  exports.pipeline = pipeline_1;
})(readableBrowser, readableBrowser.exports);
var readableBrowserExports = readableBrowser.exports;
var stream = /*@__PURE__*/getDefaultExportFromCjs(readableBrowserExports);

var lib = {};

var binding = {};

function compare(a, b) {
  if (a === b) {
    return 0;
  }

  var x = a.length;
  var y = b.length;

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }

  if (x < y) {
    return -1;
  }
  if (y < x) {
    return 1;
  }
  return 0;
}
var hasOwn = Object.prototype.hasOwnProperty;

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};
var pSlice = Array.prototype.slice;
var _functionsHaveNames;
function functionsHaveNames() {
  if (typeof _functionsHaveNames !== 'undefined') {
    return _functionsHaveNames;
  }
  return _functionsHaveNames = (function () {
    return function foo() {}.name === 'foo';
  }());
}
function pToString (obj) {
  return Object.prototype.toString.call(obj);
}
function isView(arrbuf) {
  if (isBuffer$1(arrbuf)) {
    return false;
  }
  if (typeof global$1.ArrayBuffer !== 'function') {
    return false;
  }
  if (typeof ArrayBuffer.isView === 'function') {
    return ArrayBuffer.isView(arrbuf);
  }
  if (!arrbuf) {
    return false;
  }
  if (arrbuf instanceof DataView) {
    return true;
  }
  if (arrbuf.buffer && arrbuf.buffer instanceof ArrayBuffer) {
    return true;
  }
  return false;
}
// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

function assert(value, message) {
  if (!value) fail(value, true, message, '==', ok);
}

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

var regex = /\s*function\s+([^\(\s]*)\s*/;
// based on https://github.com/ljharb/function.prototype.name/blob/adeeeec8bfcc6068b187d7d9fb3d5bb1d3a30899/implementation.js
function getName(func) {
  if (!isFunction(func)) {
    return;
  }
  if (functionsHaveNames()) {
    return func.name;
  }
  var str = func.toString();
  var match = str.match(regex);
  return match && match[1];
}
assert.AssertionError = AssertionError;
function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  } else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = getName(stackStartFunction);
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
}

// assert.AssertionError instanceof Error
inherits$3(AssertionError, Error);

function truncate(s, n) {
  if (typeof s === 'string') {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}
function inspect(something) {
  if (functionsHaveNames() || !isFunction(something)) {
    return inspect$1(something);
  }
  var rawname = getName(something);
  var name = rawname ? ': ' + rawname : '';
  return '[Function' +  name + ']';
}
function getMessage(self) {
  return truncate(inspect(self.actual), 128) + ' ' +
         self.operator + ' ' +
         truncate(inspect(self.expected), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);
assert.equal = equal;
function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', equal);
}

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);
assert.notEqual = notEqual;
function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', notEqual);
  }
}

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);
assert.deepEqual = deepEqual;
function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'deepEqual', deepEqual);
  }
}
assert.deepStrictEqual = deepStrictEqual;
function deepStrictEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'deepStrictEqual', deepStrictEqual);
  }
}

function _deepEqual(actual, expected, strict, memos) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;
  } else if (isBuffer$1(actual) && isBuffer$1(expected)) {
    return compare(actual, expected) === 0;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (isDate(actual) && isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (isRegExp(actual) && isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if ((actual === null || typeof actual !== 'object') &&
             (expected === null || typeof expected !== 'object')) {
    return strict ? actual === expected : actual == expected;

  // If both values are instances of typed arrays, wrap their underlying
  // ArrayBuffers in a Buffer each to increase performance
  // This optimization requires the arrays to have the same type as checked by
  // Object.prototype.toString (aka pToString). Never perform binary
  // comparisons for Float*Arrays, though, since e.g. +0 === -0 but their
  // bit patterns are not identical.
  } else if (isView(actual) && isView(expected) &&
             pToString(actual) === pToString(expected) &&
             !(actual instanceof Float32Array ||
               actual instanceof Float64Array)) {
    return compare(new Uint8Array(actual.buffer),
                   new Uint8Array(expected.buffer)) === 0;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else if (isBuffer$1(actual) !== isBuffer$1(expected)) {
    return false;
  } else {
    memos = memos || {actual: [], expected: []};

    var actualIndex = memos.actual.indexOf(actual);
    if (actualIndex !== -1) {
      if (actualIndex === memos.expected.indexOf(expected)) {
        return true;
      }
    }

    memos.actual.push(actual);
    memos.expected.push(expected);

    return objEquiv(actual, expected, strict, memos);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b, strict, actualVisitedObjects) {
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  // if one is a primitive, the other must be same
  if (isPrimitive(a) || isPrimitive(b))
    return a === b;
  if (strict && Object.getPrototypeOf(a) !== Object.getPrototypeOf(b))
    return false;
  var aIsArgs = isArguments(a);
  var bIsArgs = isArguments(b);
  if ((aIsArgs && !bIsArgs) || (!aIsArgs && bIsArgs))
    return false;
  if (aIsArgs) {
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b, strict);
  }
  var ka = objectKeys(a);
  var kb = objectKeys(b);
  var key, i;
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length !== kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] !== kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key], strict, actualVisitedObjects))
      return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);
assert.notDeepEqual = notDeepEqual;
function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, false)) {
    fail(actual, expected, message, 'notDeepEqual', notDeepEqual);
  }
}

assert.notDeepStrictEqual = notDeepStrictEqual;
function notDeepStrictEqual(actual, expected, message) {
  if (_deepEqual(actual, expected, true)) {
    fail(actual, expected, message, 'notDeepStrictEqual', notDeepStrictEqual);
  }
}


// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);
assert.strictEqual = strictEqual;
function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', strictEqual);
  }
}

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);
assert.notStrictEqual = notStrictEqual;
function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', notStrictEqual);
  }
}

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  }

  try {
    if (actual instanceof expected) {
      return true;
    }
  } catch (e) {
    // Ignore.  The instanceof check doesn't work for arrow functions.
  }

  if (Error.isPrototypeOf(expected)) {
    return false;
  }

  return expected.call({}, actual) === true;
}

function _tryBlock(block) {
  var error;
  try {
    block();
  } catch (e) {
    error = e;
  }
  return error;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (typeof block !== 'function') {
    throw new TypeError('"block" argument must be a function');
  }

  if (typeof expected === 'string') {
    message = expected;
    expected = null;
  }

  actual = _tryBlock(block);

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  var userProvidedMessage = typeof message === 'string';
  var isUnwantedException = !shouldThrow && isError(actual);
  var isUnexpectedException = !shouldThrow && actual && !expected;

  if ((isUnwantedException &&
      userProvidedMessage &&
      expectedException(actual, expected)) ||
      isUnexpectedException) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);
assert.throws = throws;
function throws(block, /*optional*/error, /*optional*/message) {
  _throws(true, block, error, message);
}

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = doesNotThrow;
function doesNotThrow(block, /*optional*/error, /*optional*/message) {
  _throws(false, block, error, message);
}

assert.ifError = ifError;
function ifError(err) {
  if (err) throw err;
}

var _polyfillNode_assert = /*#__PURE__*/Object.freeze({
  __proto__: null,
  AssertionError: AssertionError,
  assert: ok,
  deepEqual: deepEqual,
  deepStrictEqual: deepStrictEqual,
  default: assert,
  doesNotThrow: doesNotThrow,
  equal: equal,
  fail: fail,
  ifError: ifError,
  notDeepEqual: notDeepEqual,
  notDeepStrictEqual: notDeepStrictEqual,
  notEqual: notEqual,
  notStrictEqual: notStrictEqual,
  ok: ok,
  strictEqual: strictEqual,
  throws: throws
});

var require$$4 = /*@__PURE__*/getAugmentedNamespace(_polyfillNode_assert);

(function (exports) {

  /* eslint camelcase: "off" */
  var assert = require$$4;
  var Zstream = require$$1$2;
  var zlib_deflate = require$$2;
  var zlib_inflate = require$$3$1;
  var constants = require$$4$1;
  for (var key in constants) {
    exports[key] = constants[key];
  }

  // zlib modes
  exports.NONE = 0;
  exports.DEFLATE = 1;
  exports.INFLATE = 2;
  exports.GZIP = 3;
  exports.GUNZIP = 4;
  exports.DEFLATERAW = 5;
  exports.INFLATERAW = 6;
  exports.UNZIP = 7;
  var GZIP_HEADER_ID1 = 0x1f;
  var GZIP_HEADER_ID2 = 0x8b;

  /**
   * Emulate Node's zlib C++ layer for use by the JS layer in index.js
   */
  function Zlib(mode) {
    if (typeof mode !== 'number' || mode < exports.DEFLATE || mode > exports.UNZIP) {
      throw new TypeError('Bad argument');
    }
    this.dictionary = null;
    this.err = 0;
    this.flush = 0;
    this.init_done = false;
    this.level = 0;
    this.memLevel = 0;
    this.mode = mode;
    this.strategy = 0;
    this.windowBits = 0;
    this.write_in_progress = false;
    this.pending_close = false;
    this.gzip_id_bytes_read = 0;
  }
  Zlib.prototype.close = function () {
    if (this.write_in_progress) {
      this.pending_close = true;
      return;
    }
    this.pending_close = false;
    assert(this.init_done, 'close before init');
    assert(this.mode <= exports.UNZIP);
    if (this.mode === exports.DEFLATE || this.mode === exports.GZIP || this.mode === exports.DEFLATERAW) {
      zlib_deflate.deflateEnd(this.strm);
    } else if (this.mode === exports.INFLATE || this.mode === exports.GUNZIP || this.mode === exports.INFLATERAW || this.mode === exports.UNZIP) {
      zlib_inflate.inflateEnd(this.strm);
    }
    this.mode = exports.NONE;
    this.dictionary = null;
  };
  Zlib.prototype.write = function (flush, input, in_off, in_len, out, out_off, out_len) {
    return this._write(true, flush, input, in_off, in_len, out, out_off, out_len);
  };
  Zlib.prototype.writeSync = function (flush, input, in_off, in_len, out, out_off, out_len) {
    return this._write(false, flush, input, in_off, in_len, out, out_off, out_len);
  };
  Zlib.prototype._write = function (async, flush, input, in_off, in_len, out, out_off, out_len) {
    assert.equal(arguments.length, 8);
    assert(this.init_done, 'write before init');
    assert(this.mode !== exports.NONE, 'already finalized');
    assert.equal(false, this.write_in_progress, 'write already in progress');
    assert.equal(false, this.pending_close, 'close is pending');
    this.write_in_progress = true;
    assert.equal(false, flush === undefined, 'must provide flush value');
    this.write_in_progress = true;
    if (flush !== exports.Z_NO_FLUSH && flush !== exports.Z_PARTIAL_FLUSH && flush !== exports.Z_SYNC_FLUSH && flush !== exports.Z_FULL_FLUSH && flush !== exports.Z_FINISH && flush !== exports.Z_BLOCK) {
      throw new Error('Invalid flush value');
    }
    if (input == null) {
      input = Buffer$2.alloc(0);
      in_len = 0;
      in_off = 0;
    }
    this.strm.avail_in = in_len;
    this.strm.input = input;
    this.strm.next_in = in_off;
    this.strm.avail_out = out_len;
    this.strm.output = out;
    this.strm.next_out = out_off;
    this.flush = flush;
    if (!async) {
      // sync version
      this._process();
      if (this._checkError()) {
        return this._afterSync();
      }
      return;
    }

    // async version
    var self = this;
    browser$1$1.nextTick(function () {
      self._process();
      self._after();
    });
    return this;
  };
  Zlib.prototype._afterSync = function () {
    var avail_out = this.strm.avail_out;
    var avail_in = this.strm.avail_in;
    this.write_in_progress = false;
    return [avail_in, avail_out];
  };
  Zlib.prototype._process = function () {
    var next_expected_header_byte = null;

    // If the avail_out is left at 0, then it means that it ran out
    // of room.  If there was avail_out left over, then it means
    // that all of the input was consumed.
    switch (this.mode) {
      case exports.DEFLATE:
      case exports.GZIP:
      case exports.DEFLATERAW:
        this.err = zlib_deflate.deflate(this.strm, this.flush);
        break;
      case exports.UNZIP:
        if (this.strm.avail_in > 0) {
          next_expected_header_byte = this.strm.next_in;
        }
        switch (this.gzip_id_bytes_read) {
          case 0:
            if (next_expected_header_byte === null) {
              break;
            }
            if (this.strm.input[next_expected_header_byte] === GZIP_HEADER_ID1) {
              this.gzip_id_bytes_read = 1;
              next_expected_header_byte++;
              if (this.strm.avail_in === 1) {
                // The only available byte was already read.
                break;
              }
            } else {
              this.mode = exports.INFLATE;
              break;
            }

          // fallthrough
          case 1:
            if (next_expected_header_byte === null) {
              break;
            }
            if (this.strm.input[next_expected_header_byte] === GZIP_HEADER_ID2) {
              this.gzip_id_bytes_read = 2;
              this.mode = exports.GUNZIP;
            } else {
              // There is no actual difference between INFLATE and INFLATERAW
              // (after initialization).
              this.mode = exports.INFLATE;
            }
            break;
          default:
            throw new Error('invalid number of gzip magic number bytes read');
        }

      // fallthrough
      case exports.INFLATE:
      case exports.GUNZIP:
      case exports.INFLATERAW:
        this.err = zlib_inflate.inflate(this.strm, this.flush

        // If data was encoded with dictionary
        );
        if (this.err === exports.Z_NEED_DICT && this.dictionary) {
          // Load it
          this.err = zlib_inflate.inflateSetDictionary(this.strm, this.dictionary);
          if (this.err === exports.Z_OK) {
            // And try to decode again
            this.err = zlib_inflate.inflate(this.strm, this.flush);
          } else if (this.err === exports.Z_DATA_ERROR) {
            // Both inflateSetDictionary() and inflate() return Z_DATA_ERROR.
            // Make it possible for After() to tell a bad dictionary from bad
            // input.
            this.err = exports.Z_NEED_DICT;
          }
        }
        while (this.strm.avail_in > 0 && this.mode === exports.GUNZIP && this.err === exports.Z_STREAM_END && this.strm.next_in[0] !== 0x00) {
          // Bytes remain in input buffer. Perhaps this is another compressed
          // member in the same archive, or just trailing garbage.
          // Trailing zero bytes are okay, though, since they are frequently
          // used for padding.

          this.reset();
          this.err = zlib_inflate.inflate(this.strm, this.flush);
        }
        break;
      default:
        throw new Error('Unknown mode ' + this.mode);
    }
  };
  Zlib.prototype._checkError = function () {
    // Acceptable error states depend on the type of zlib stream.
    switch (this.err) {
      case exports.Z_OK:
      case exports.Z_BUF_ERROR:
        if (this.strm.avail_out !== 0 && this.flush === exports.Z_FINISH) {
          this._error('unexpected end of file');
          return false;
        }
        break;
      case exports.Z_STREAM_END:
        // normal statuses, not fatal
        break;
      case exports.Z_NEED_DICT:
        if (this.dictionary == null) {
          this._error('Missing dictionary');
        } else {
          this._error('Bad dictionary');
        }
        return false;
      default:
        // something else.
        this._error('Zlib error');
        return false;
    }
    return true;
  };
  Zlib.prototype._after = function () {
    if (!this._checkError()) {
      return;
    }
    var avail_out = this.strm.avail_out;
    var avail_in = this.strm.avail_in;
    this.write_in_progress = false;

    // call the write() cb
    this.callback(avail_in, avail_out);
    if (this.pending_close) {
      this.close();
    }
  };
  Zlib.prototype._error = function (message) {
    if (this.strm.msg) {
      message = this.strm.msg;
    }
    this.onerror(message, this.err

    // no hope of rescue.
    );
    this.write_in_progress = false;
    if (this.pending_close) {
      this.close();
    }
  };
  Zlib.prototype.init = function (windowBits, level, memLevel, strategy, dictionary) {
    assert(arguments.length === 4 || arguments.length === 5, 'init(windowBits, level, memLevel, strategy, [dictionary])');
    assert(windowBits >= 8 && windowBits <= 15, 'invalid windowBits');
    assert(level >= -1 && level <= 9, 'invalid compression level');
    assert(memLevel >= 1 && memLevel <= 9, 'invalid memlevel');
    assert(strategy === exports.Z_FILTERED || strategy === exports.Z_HUFFMAN_ONLY || strategy === exports.Z_RLE || strategy === exports.Z_FIXED || strategy === exports.Z_DEFAULT_STRATEGY, 'invalid strategy');
    this._init(level, windowBits, memLevel, strategy, dictionary);
    this._setDictionary();
  };
  Zlib.prototype.params = function () {
    throw new Error('deflateParams Not supported');
  };
  Zlib.prototype.reset = function () {
    this._reset();
    this._setDictionary();
  };
  Zlib.prototype._init = function (level, windowBits, memLevel, strategy, dictionary) {
    this.level = level;
    this.windowBits = windowBits;
    this.memLevel = memLevel;
    this.strategy = strategy;
    this.flush = exports.Z_NO_FLUSH;
    this.err = exports.Z_OK;
    if (this.mode === exports.GZIP || this.mode === exports.GUNZIP) {
      this.windowBits += 16;
    }
    if (this.mode === exports.UNZIP) {
      this.windowBits += 32;
    }
    if (this.mode === exports.DEFLATERAW || this.mode === exports.INFLATERAW) {
      this.windowBits = -1 * this.windowBits;
    }
    this.strm = new Zstream();
    switch (this.mode) {
      case exports.DEFLATE:
      case exports.GZIP:
      case exports.DEFLATERAW:
        this.err = zlib_deflate.deflateInit2(this.strm, this.level, exports.Z_DEFLATED, this.windowBits, this.memLevel, this.strategy);
        break;
      case exports.INFLATE:
      case exports.GUNZIP:
      case exports.INFLATERAW:
      case exports.UNZIP:
        this.err = zlib_inflate.inflateInit2(this.strm, this.windowBits);
        break;
      default:
        throw new Error('Unknown mode ' + this.mode);
    }
    if (this.err !== exports.Z_OK) {
      this._error('Init error');
    }
    this.dictionary = dictionary;
    this.write_in_progress = false;
    this.init_done = true;
  };
  Zlib.prototype._setDictionary = function () {
    if (this.dictionary == null) {
      return;
    }
    this.err = exports.Z_OK;
    switch (this.mode) {
      case exports.DEFLATE:
      case exports.DEFLATERAW:
        this.err = zlib_deflate.deflateSetDictionary(this.strm, this.dictionary);
        break;
    }
    if (this.err !== exports.Z_OK) {
      this._error('Failed to set dictionary');
    }
  };
  Zlib.prototype._reset = function () {
    this.err = exports.Z_OK;
    switch (this.mode) {
      case exports.DEFLATE:
      case exports.DEFLATERAW:
      case exports.GZIP:
        this.err = zlib_deflate.deflateReset(this.strm);
        break;
      case exports.INFLATE:
      case exports.INFLATERAW:
      case exports.GUNZIP:
        this.err = zlib_inflate.inflateReset(this.strm);
        break;
    }
    if (this.err !== exports.Z_OK) {
      this._error('Failed to reset stream');
    }
  };
  exports.Zlib = Zlib;
})(binding);

(function (exports) {

  var Buffer = require$$0.Buffer;
  var Transform = readableBrowserExports.Transform;
  var binding$1 = binding;
  var util = require$$3;
  var assert = require$$4.ok;
  var kMaxLength = require$$0.kMaxLength;
  var kRangeErrorMessage = 'Cannot create final Buffer. It would be larger ' + 'than 0x' + kMaxLength.toString(16) + ' bytes';

  // zlib doesn't provide these, so kludge them in following the same
  // const naming scheme zlib uses.
  binding$1.Z_MIN_WINDOWBITS = 8;
  binding$1.Z_MAX_WINDOWBITS = 15;
  binding$1.Z_DEFAULT_WINDOWBITS = 15;

  // fewer than 64 bytes per chunk is stupid.
  // technically it could work with as few as 8, but even 64 bytes
  // is absurdly low.  Usually a MB or more is best.
  binding$1.Z_MIN_CHUNK = 64;
  binding$1.Z_MAX_CHUNK = Infinity;
  binding$1.Z_DEFAULT_CHUNK = 16 * 1024;
  binding$1.Z_MIN_MEMLEVEL = 1;
  binding$1.Z_MAX_MEMLEVEL = 9;
  binding$1.Z_DEFAULT_MEMLEVEL = 8;
  binding$1.Z_MIN_LEVEL = -1;
  binding$1.Z_MAX_LEVEL = 9;
  binding$1.Z_DEFAULT_LEVEL = binding$1.Z_DEFAULT_COMPRESSION;

  // expose all the zlib constants
  var bkeys = Object.keys(binding$1);
  for (var bk = 0; bk < bkeys.length; bk++) {
    var bkey = bkeys[bk];
    if (bkey.match(/^Z/)) {
      Object.defineProperty(exports, bkey, {
        enumerable: true,
        value: binding$1[bkey],
        writable: false
      });
    }
  }

  // translation table for return codes.
  var codes = {
    Z_OK: binding$1.Z_OK,
    Z_STREAM_END: binding$1.Z_STREAM_END,
    Z_NEED_DICT: binding$1.Z_NEED_DICT,
    Z_ERRNO: binding$1.Z_ERRNO,
    Z_STREAM_ERROR: binding$1.Z_STREAM_ERROR,
    Z_DATA_ERROR: binding$1.Z_DATA_ERROR,
    Z_MEM_ERROR: binding$1.Z_MEM_ERROR,
    Z_BUF_ERROR: binding$1.Z_BUF_ERROR,
    Z_VERSION_ERROR: binding$1.Z_VERSION_ERROR
  };
  var ckeys = Object.keys(codes);
  for (var ck = 0; ck < ckeys.length; ck++) {
    var ckey = ckeys[ck];
    codes[codes[ckey]] = ckey;
  }
  Object.defineProperty(exports, 'codes', {
    enumerable: true,
    value: Object.freeze(codes),
    writable: false
  });
  exports.Deflate = Deflate;
  exports.Inflate = Inflate;
  exports.Gzip = Gzip;
  exports.Gunzip = Gunzip;
  exports.DeflateRaw = DeflateRaw;
  exports.InflateRaw = InflateRaw;
  exports.Unzip = Unzip;
  exports.createDeflate = function (o) {
    return new Deflate(o);
  };
  exports.createInflate = function (o) {
    return new Inflate(o);
  };
  exports.createDeflateRaw = function (o) {
    return new DeflateRaw(o);
  };
  exports.createInflateRaw = function (o) {
    return new InflateRaw(o);
  };
  exports.createGzip = function (o) {
    return new Gzip(o);
  };
  exports.createGunzip = function (o) {
    return new Gunzip(o);
  };
  exports.createUnzip = function (o) {
    return new Unzip(o);
  };

  // Convenience methods.
  // compress/decompress a string or buffer in one step.
  exports.deflate = function (buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Deflate(opts), buffer, callback);
  };
  exports.deflateSync = function (buffer, opts) {
    return zlibBufferSync(new Deflate(opts), buffer);
  };
  exports.gzip = function (buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Gzip(opts), buffer, callback);
  };
  exports.gzipSync = function (buffer, opts) {
    return zlibBufferSync(new Gzip(opts), buffer);
  };
  exports.deflateRaw = function (buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new DeflateRaw(opts), buffer, callback);
  };
  exports.deflateRawSync = function (buffer, opts) {
    return zlibBufferSync(new DeflateRaw(opts), buffer);
  };
  exports.unzip = function (buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Unzip(opts), buffer, callback);
  };
  exports.unzipSync = function (buffer, opts) {
    return zlibBufferSync(new Unzip(opts), buffer);
  };
  exports.inflate = function (buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Inflate(opts), buffer, callback);
  };
  exports.inflateSync = function (buffer, opts) {
    return zlibBufferSync(new Inflate(opts), buffer);
  };
  exports.gunzip = function (buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new Gunzip(opts), buffer, callback);
  };
  exports.gunzipSync = function (buffer, opts) {
    return zlibBufferSync(new Gunzip(opts), buffer);
  };
  exports.inflateRaw = function (buffer, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    return zlibBuffer(new InflateRaw(opts), buffer, callback);
  };
  exports.inflateRawSync = function (buffer, opts) {
    return zlibBufferSync(new InflateRaw(opts), buffer);
  };
  function zlibBuffer(engine, buffer, callback) {
    var buffers = [];
    var nread = 0;
    engine.on('error', onError);
    engine.on('end', onEnd);
    engine.end(buffer);
    flow();
    function flow() {
      var chunk;
      while (null !== (chunk = engine.read())) {
        buffers.push(chunk);
        nread += chunk.length;
      }
      engine.once('readable', flow);
    }
    function onError(err) {
      engine.removeListener('end', onEnd);
      engine.removeListener('readable', flow);
      callback(err);
    }
    function onEnd() {
      var buf;
      var err = null;
      if (nread >= kMaxLength) {
        err = new RangeError(kRangeErrorMessage);
      } else {
        buf = Buffer.concat(buffers, nread);
      }
      buffers = [];
      engine.close();
      callback(err, buf);
    }
  }
  function zlibBufferSync(engine, buffer) {
    if (typeof buffer === 'string') buffer = Buffer.from(buffer);
    if (!Buffer.isBuffer(buffer)) throw new TypeError('Not a string or buffer');
    var flushFlag = engine._finishFlushFlag;
    return engine._processChunk(buffer, flushFlag);
  }

  // generic zlib
  // minimal 2-byte header
  function Deflate(opts) {
    if (!(this instanceof Deflate)) return new Deflate(opts);
    Zlib.call(this, opts, binding$1.DEFLATE);
  }
  function Inflate(opts) {
    if (!(this instanceof Inflate)) return new Inflate(opts);
    Zlib.call(this, opts, binding$1.INFLATE);
  }

  // gzip - bigger header, same deflate compression
  function Gzip(opts) {
    if (!(this instanceof Gzip)) return new Gzip(opts);
    Zlib.call(this, opts, binding$1.GZIP);
  }
  function Gunzip(opts) {
    if (!(this instanceof Gunzip)) return new Gunzip(opts);
    Zlib.call(this, opts, binding$1.GUNZIP);
  }

  // raw - no header
  function DeflateRaw(opts) {
    if (!(this instanceof DeflateRaw)) return new DeflateRaw(opts);
    Zlib.call(this, opts, binding$1.DEFLATERAW);
  }
  function InflateRaw(opts) {
    if (!(this instanceof InflateRaw)) return new InflateRaw(opts);
    Zlib.call(this, opts, binding$1.INFLATERAW);
  }

  // auto-detect header.
  function Unzip(opts) {
    if (!(this instanceof Unzip)) return new Unzip(opts);
    Zlib.call(this, opts, binding$1.UNZIP);
  }
  function isValidFlushFlag(flag) {
    return flag === binding$1.Z_NO_FLUSH || flag === binding$1.Z_PARTIAL_FLUSH || flag === binding$1.Z_SYNC_FLUSH || flag === binding$1.Z_FULL_FLUSH || flag === binding$1.Z_FINISH || flag === binding$1.Z_BLOCK;
  }

  // the Zlib class they all inherit from
  // This thing manages the queue of requests, and returns
  // true or false if there is anything in the queue when
  // you call the .write() method.

  function Zlib(opts, mode) {
    var _this = this;
    this._opts = opts = opts || {};
    this._chunkSize = opts.chunkSize || exports.Z_DEFAULT_CHUNK;
    Transform.call(this, opts);
    if (opts.flush && !isValidFlushFlag(opts.flush)) {
      throw new Error('Invalid flush flag: ' + opts.flush);
    }
    if (opts.finishFlush && !isValidFlushFlag(opts.finishFlush)) {
      throw new Error('Invalid flush flag: ' + opts.finishFlush);
    }
    this._flushFlag = opts.flush || binding$1.Z_NO_FLUSH;
    this._finishFlushFlag = typeof opts.finishFlush !== 'undefined' ? opts.finishFlush : binding$1.Z_FINISH;
    if (opts.chunkSize) {
      if (opts.chunkSize < exports.Z_MIN_CHUNK || opts.chunkSize > exports.Z_MAX_CHUNK) {
        throw new Error('Invalid chunk size: ' + opts.chunkSize);
      }
    }
    if (opts.windowBits) {
      if (opts.windowBits < exports.Z_MIN_WINDOWBITS || opts.windowBits > exports.Z_MAX_WINDOWBITS) {
        throw new Error('Invalid windowBits: ' + opts.windowBits);
      }
    }
    if (opts.level) {
      if (opts.level < exports.Z_MIN_LEVEL || opts.level > exports.Z_MAX_LEVEL) {
        throw new Error('Invalid compression level: ' + opts.level);
      }
    }
    if (opts.memLevel) {
      if (opts.memLevel < exports.Z_MIN_MEMLEVEL || opts.memLevel > exports.Z_MAX_MEMLEVEL) {
        throw new Error('Invalid memLevel: ' + opts.memLevel);
      }
    }
    if (opts.strategy) {
      if (opts.strategy != exports.Z_FILTERED && opts.strategy != exports.Z_HUFFMAN_ONLY && opts.strategy != exports.Z_RLE && opts.strategy != exports.Z_FIXED && opts.strategy != exports.Z_DEFAULT_STRATEGY) {
        throw new Error('Invalid strategy: ' + opts.strategy);
      }
    }
    if (opts.dictionary) {
      if (!Buffer.isBuffer(opts.dictionary)) {
        throw new Error('Invalid dictionary: it should be a Buffer instance');
      }
    }
    this._handle = new binding$1.Zlib(mode);
    var self = this;
    this._hadError = false;
    this._handle.onerror = function (message, errno) {
      // there is no way to cleanly recover.
      // continuing only obscures problems.
      _close(self);
      self._hadError = true;
      var error = new Error(message);
      error.errno = errno;
      error.code = exports.codes[errno];
      self.emit('error', error);
    };
    var level = exports.Z_DEFAULT_COMPRESSION;
    if (typeof opts.level === 'number') level = opts.level;
    var strategy = exports.Z_DEFAULT_STRATEGY;
    if (typeof opts.strategy === 'number') strategy = opts.strategy;
    this._handle.init(opts.windowBits || exports.Z_DEFAULT_WINDOWBITS, level, opts.memLevel || exports.Z_DEFAULT_MEMLEVEL, strategy, opts.dictionary);
    this._buffer = Buffer.allocUnsafe(this._chunkSize);
    this._offset = 0;
    this._level = level;
    this._strategy = strategy;
    this.once('end', this.close);
    Object.defineProperty(this, '_closed', {
      get: function () {
        return !_this._handle;
      },
      configurable: true,
      enumerable: true
    });
  }
  util.inherits(Zlib, Transform);
  Zlib.prototype.params = function (level, strategy, callback) {
    if (level < exports.Z_MIN_LEVEL || level > exports.Z_MAX_LEVEL) {
      throw new RangeError('Invalid compression level: ' + level);
    }
    if (strategy != exports.Z_FILTERED && strategy != exports.Z_HUFFMAN_ONLY && strategy != exports.Z_RLE && strategy != exports.Z_FIXED && strategy != exports.Z_DEFAULT_STRATEGY) {
      throw new TypeError('Invalid strategy: ' + strategy);
    }
    if (this._level !== level || this._strategy !== strategy) {
      var self = this;
      this.flush(binding$1.Z_SYNC_FLUSH, function () {
        assert(self._handle, 'zlib binding closed');
        self._handle.params(level, strategy);
        if (!self._hadError) {
          self._level = level;
          self._strategy = strategy;
          if (callback) callback();
        }
      });
    } else {
      browser$1$1.nextTick(callback);
    }
  };
  Zlib.prototype.reset = function () {
    assert(this._handle, 'zlib binding closed');
    return this._handle.reset();
  };

  // This is the _flush function called by the transform class,
  // internally, when the last chunk has been written.
  Zlib.prototype._flush = function (callback) {
    this._transform(Buffer.alloc(0), '', callback);
  };
  Zlib.prototype.flush = function (kind, callback) {
    var _this2 = this;
    var ws = this._writableState;
    if (typeof kind === 'function' || kind === undefined && !callback) {
      callback = kind;
      kind = binding$1.Z_FULL_FLUSH;
    }
    if (ws.ended) {
      if (callback) browser$1$1.nextTick(callback);
    } else if (ws.ending) {
      if (callback) this.once('end', callback);
    } else if (ws.needDrain) {
      if (callback) {
        this.once('drain', function () {
          return _this2.flush(kind, callback);
        });
      }
    } else {
      this._flushFlag = kind;
      this.write(Buffer.alloc(0), '', callback);
    }
  };
  Zlib.prototype.close = function (callback) {
    _close(this, callback);
    browser$1$1.nextTick(emitCloseNT, this);
  };
  function _close(engine, callback) {
    if (callback) browser$1$1.nextTick(callback);

    // Caller may invoke .close after a zlib error (which will null _handle).
    if (!engine._handle) return;
    engine._handle.close();
    engine._handle = null;
  }
  function emitCloseNT(self) {
    self.emit('close');
  }
  Zlib.prototype._transform = function (chunk, encoding, cb) {
    var flushFlag;
    var ws = this._writableState;
    var ending = ws.ending || ws.ended;
    var last = ending && (!chunk || ws.length === chunk.length);
    if (chunk !== null && !Buffer.isBuffer(chunk)) return cb(new Error('invalid input'));
    if (!this._handle) return cb(new Error('zlib binding closed'));

    // If it's the last chunk, or a final flush, we use the Z_FINISH flush flag
    // (or whatever flag was provided using opts.finishFlush).
    // If it's explicitly flushing at some other time, then we use
    // Z_FULL_FLUSH. Otherwise, use Z_NO_FLUSH for maximum compression
    // goodness.
    if (last) flushFlag = this._finishFlushFlag;else {
      flushFlag = this._flushFlag;
      // once we've flushed the last of the queue, stop flushing and
      // go back to the normal behavior.
      if (chunk.length >= ws.length) {
        this._flushFlag = this._opts.flush || binding$1.Z_NO_FLUSH;
      }
    }
    this._processChunk(chunk, flushFlag, cb);
  };
  Zlib.prototype._processChunk = function (chunk, flushFlag, cb) {
    var availInBefore = chunk && chunk.length;
    var availOutBefore = this._chunkSize - this._offset;
    var inOff = 0;
    var self = this;
    var async = typeof cb === 'function';
    if (!async) {
      var buffers = [];
      var nread = 0;
      var error;
      this.on('error', function (er) {
        error = er;
      });
      assert(this._handle, 'zlib binding closed');
      do {
        var res = this._handle.writeSync(flushFlag, chunk,
        // in
        inOff,
        // in_off
        availInBefore,
        // in_len
        this._buffer,
        // out
        this._offset,
        //out_off
        availOutBefore); // out_len
      } while (!this._hadError && callback(res[0], res[1]));
      if (this._hadError) {
        throw error;
      }
      if (nread >= kMaxLength) {
        _close(this);
        throw new RangeError(kRangeErrorMessage);
      }
      var buf = Buffer.concat(buffers, nread);
      _close(this);
      return buf;
    }
    assert(this._handle, 'zlib binding closed');
    var req = this._handle.write(flushFlag, chunk,
    // in
    inOff,
    // in_off
    availInBefore,
    // in_len
    this._buffer,
    // out
    this._offset,
    //out_off
    availOutBefore); // out_len

    req.buffer = chunk;
    req.callback = callback;
    function callback(availInAfter, availOutAfter) {
      // When the callback is used in an async write, the callback's
      // context is the `req` object that was created. The req object
      // is === this._handle, and that's why it's important to null
      // out the values after they are done being used. `this._handle`
      // can stay in memory longer than the callback and buffer are needed.
      if (this) {
        this.buffer = null;
        this.callback = null;
      }
      if (self._hadError) return;
      var have = availOutBefore - availOutAfter;
      assert(have >= 0, 'have should not go down');
      if (have > 0) {
        var out = self._buffer.slice(self._offset, self._offset + have);
        self._offset += have;
        // serve some output to the consumer.
        if (async) {
          self.push(out);
        } else {
          buffers.push(out);
          nread += out.length;
        }
      }

      // exhausted the output buffer, or used all the input create a new one.
      if (availOutAfter === 0 || self._offset >= self._chunkSize) {
        availOutBefore = self._chunkSize;
        self._offset = 0;
        self._buffer = Buffer.allocUnsafe(self._chunkSize);
      }
      if (availOutAfter === 0) {
        // Not actually done.  Need to reprocess.
        // Also, update the availInBefore to the availInAfter value,
        // so that if we have to hit it a third (fourth, etc.) time,
        // it'll have the correct byte counts.
        inOff += availInBefore - availInAfter;
        availInBefore = availInAfter;
        if (!async) return true;
        var newReq = self._handle.write(flushFlag, chunk, inOff, availInBefore, self._buffer, self._offset, self._chunkSize);
        newReq.callback = callback; // this same function
        newReq.buffer = chunk;
        return;
      }
      if (!async) return false;

      // finished with the chunk.
      cb();
    }
  };
  util.inherits(Deflate, Zlib);
  util.inherits(Inflate, Zlib);
  util.inherits(Gzip, Zlib);
  util.inherits(Gunzip, Zlib);
  util.inherits(DeflateRaw, Zlib);
  util.inherits(InflateRaw, Zlib);
  util.inherits(Unzip, Zlib);
})(lib);
var zlib = /*@__PURE__*/getDefaultExportFromCjs(lib);

class PDFReference extends stream.Writable {
  constructor(document, id, data) {
    super({
      decodeStrings: false
    });
    this.finalize = this.finalize.bind(this);
    this.document = document;
    this.id = id;
    if (data == null) {
      data = {};
    }
    this.data = data;
    this.gen = 0;
    this.deflate = null;
    this.compress = this.document.compress && !this.data.Filter;
    this.uncompressedLength = 0;
    this.chunks = [];
  }
  initDeflate() {
    this.data.Filter = 'FlateDecode';
    this.deflate = zlib.createDeflate();
    this.deflate.on('data', chunk => {
      this.chunks.push(chunk);
      return this.data.Length += chunk.length;
    });
    return this.deflate.on('end', this.finalize);
  }
  _write(chunk, encoding, callback) {
    if (!(chunk instanceof Uint8Array)) {
      chunk = Buffer$2.from(chunk + '\n', 'binary');
    }
    this.uncompressedLength += chunk.length;
    if (this.data.Length == null) {
      this.data.Length = 0;
    }
    if (this.compress) {
      if (!this.deflate) {
        this.initDeflate();
      }
      this.deflate.write(chunk);
    } else {
      this.chunks.push(chunk);
      this.data.Length += chunk.length;
    }
    return callback();
  }
  end() {
    super.end(...arguments);
    if (this.deflate) {
      return this.deflate.end();
    }
    return this.finalize();
  }
  finalize() {
    this.offset = this.document._offset;
    this.document._write(`${this.id} ${this.gen} obj`);
    this.document._write(PDFObject$1.convert(this.data));
    if (this.chunks.length) {
      this.document._write('stream');
      for (let chunk of Array.from(this.chunks)) {
        this.document._write(chunk);
      }
      this.chunks.length = 0; // free up memory
      this.document._write('\nendstream');
    }
    this.document._write('endobj');
    return this.document._refEnd(this);
  }
  toString() {
    return `${this.id} ${this.gen} R`;
  }
}

/*
PDFTree - abstract base class for name and number tree objects
*/

class PDFTree {
  constructor(options) {
    if (options === void 0) {
      options = {};
    }
    this._items = {};
    // disable /Limits output for this tree
    this.limits = typeof options.limits === 'boolean' ? options.limits : true;
  }
  add(key, val) {
    return this._items[key] = val;
  }
  get(key) {
    return this._items[key];
  }
  toString() {
    // Needs to be sorted by key
    const sortedKeys = Object.keys(this._items).sort((a, b) => this._compareKeys(a, b));
    const out = ['<<'];
    if (this.limits && sortedKeys.length > 1) {
      const first = sortedKeys[0],
        last = sortedKeys[sortedKeys.length - 1];
      out.push(`  /Limits ${PDFObject$1.convert([this._dataForKey(first), this._dataForKey(last)])}`);
    }
    out.push(`  /${this._keysName()} [`);
    for (let key of sortedKeys) {
      out.push(`    ${PDFObject$1.convert(this._dataForKey(key))} ${PDFObject$1.convert(this._items[key])}`);
    }
    out.push(']');
    out.push('>>');
    return out.join('\n');
  }
  _compareKeys( /*a, b*/
  ) {
    throw new Error('Must be implemented by subclasses');
  }
  _keysName() {
    throw new Error('Must be implemented by subclasses');
  }
  _dataForKey( /*k*/
  ) {
    throw new Error('Must be implemented by subclasses');
  }
}

/*
PDFNameTree - represents a name tree object
*/

class PDFNameTree extends PDFTree {
  _compareKeys(a, b) {
    return a.localeCompare(b);
  }
  _keysName() {
    return 'Names';
  }
  _dataForKey(k) {
    return new String(k);
  }
}

const escapableRe = /[\n\r\t\b\f\(\)\\]/g;
const escapable = {
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t',
  '\b': '\\b',
  '\f': '\\f',
  '\\': '\\\\',
  '(': '\\(',
  ')': '\\)'
};
const pad = (str, length) => (Array(length + 1).join('0') + str).slice(-length);

// Convert little endian UTF-16 to big endian
const swapBytes = function (buff) {
  const l = buff.length;
  if (l & 0x01) {
    throw new Error('Buffer length must be even');
  } else {
    for (let i = 0, end = l - 1; i < end; i += 2) {
      const a = buff[i];
      buff[i] = buff[i + 1];
      buff[i + 1] = a;
    }
  }
  return buff;
};
class PDFObject {
  static convert(object) {
    // String literals are converted to the PDF name type
    if (typeof object === 'string') {
      return `/${object}`;
    }

    // String objects are converted to PDF strings (UTF-16)
    if (object instanceof String) {
      let string = object;
      // Detect if this is a unicode string
      let isUnicode = false;
      for (let i = 0, end = string.length; i < end; i++) {
        if (string.charCodeAt(i) > 0x7f) {
          isUnicode = true;
          break;
        }
      }

      // If so, encode it as big endian UTF-16
      if (isUnicode) {
        string = swapBytes(Buffer$2.from(`\ufeff${string}`, 'utf16le')).toString('binary');
      }

      // Escape characters as required by the spec
      string = string.replace(escapableRe, c => escapable[c]);
      return `(${string})`;

      // Buffers are converted to PDF hex strings
    }
    if (Buffer$2.isBuffer(object)) {
      return `<${object.toString('hex')}>`;
    }
    if (object instanceof PDFReference || object instanceof PDFNameTree) {
      return object.toString();
    }
    if (object instanceof Date) {
      return `(D:${pad(object.getUTCFullYear(), 4)}` + pad(object.getUTCMonth() + 1, 2) + pad(object.getUTCDate(), 2) + pad(object.getUTCHours(), 2) + pad(object.getUTCMinutes(), 2) + pad(object.getUTCSeconds(), 2) + 'Z)';
    }
    if (Array.isArray(object)) {
      const items = Array.from(object).map(e => PDFObject.convert(e)).join(' ');
      return `[${items}]`;
    }
    if ({}.toString.call(object) === '[object Object]') {
      const out = ['<<'];
      for (let key in object) {
        const val = object[key];
        out.push(`/${key} ${PDFObject.convert(val)}`);
      }
      out.push('>>');
      return out.join('\n');
    }
    if (typeof object === 'number') {
      return PDFObject.number(object);
    }
    return `${object}`;
  }
  static number(n) {
    if (n > -1e21 && n < 1e21) {
      return Math.round(n * 1e6) / 1e6;
    }
    throw new Error(`unsupported number: ${n}`);
  }
}
var PDFObject$1 = PDFObject;

/*
PDFPage - represents a single page in the PDF document
By Devon Govett
*/

const DEFAULT_MARGINS = {
  top: 72,
  left: 72,
  bottom: 72,
  right: 72
};
const SIZES = {
  '4A0': [4767.87, 6740.79],
  '2A0': [3370.39, 4767.87],
  A0: [2383.94, 3370.39],
  A1: [1683.78, 2383.94],
  A2: [1190.55, 1683.78],
  A3: [841.89, 1190.55],
  A4: [595.28, 841.89],
  A5: [419.53, 595.28],
  A6: [297.64, 419.53],
  A7: [209.76, 297.64],
  A8: [147.4, 209.76],
  A9: [104.88, 147.4],
  A10: [73.7, 104.88],
  B0: [2834.65, 4008.19],
  B1: [2004.09, 2834.65],
  B2: [1417.32, 2004.09],
  B3: [1000.63, 1417.32],
  B4: [708.66, 1000.63],
  B5: [498.9, 708.66],
  B6: [354.33, 498.9],
  B7: [249.45, 354.33],
  B8: [175.75, 249.45],
  B9: [124.72, 175.75],
  B10: [87.87, 124.72],
  C0: [2599.37, 3676.54],
  C1: [1836.85, 2599.37],
  C2: [1298.27, 1836.85],
  C3: [918.43, 1298.27],
  C4: [649.13, 918.43],
  C5: [459.21, 649.13],
  C6: [323.15, 459.21],
  C7: [229.61, 323.15],
  C8: [161.57, 229.61],
  C9: [113.39, 161.57],
  C10: [79.37, 113.39],
  RA0: [2437.8, 3458.27],
  RA1: [1729.13, 2437.8],
  RA2: [1218.9, 1729.13],
  RA3: [864.57, 1218.9],
  RA4: [609.45, 864.57],
  SRA0: [2551.18, 3628.35],
  SRA1: [1814.17, 2551.18],
  SRA2: [1275.59, 1814.17],
  SRA3: [907.09, 1275.59],
  SRA4: [637.8, 907.09],
  EXECUTIVE: [521.86, 756.0],
  FOLIO: [612.0, 936.0],
  LEGAL: [612.0, 1008.0],
  LETTER: [612.0, 792.0],
  TABLOID: [792.0, 1224.0]
};
class PDFPage {
  constructor(document, options) {
    if (options === void 0) {
      options = {};
    }
    this.document = document;
    this.size = options.size || 'letter';
    this.layout = options.layout || 'portrait';
    this.userUnit = options.userUnit || 1.0;

    // process margins
    if (typeof options.margin === 'number') {
      this.margins = {
        top: options.margin,
        left: options.margin,
        bottom: options.margin,
        right: options.margin
      };

      // default to 1 inch margins
    } else {
      this.margins = options.margins || DEFAULT_MARGINS;
    }

    // calculate page dimensions
    const dimensions = Array.isArray(this.size) ? this.size : SIZES[this.size.toUpperCase()];
    this.width = dimensions[this.layout === 'portrait' ? 0 : 1];
    this.height = dimensions[this.layout === 'portrait' ? 1 : 0];
    this.content = this.document.ref();

    // Initialize the Font, XObject, and ExtGState dictionaries
    this.resources = this.document.ref({
      ProcSet: ['PDF', 'Text', 'ImageB', 'ImageC', 'ImageI']
    });

    // The page dictionary
    this.dictionary = this.document.ref({
      Type: 'Page',
      Parent: this.document._root.data.Pages,
      MediaBox: [0, 0, this.width, this.height],
      Contents: this.content,
      Resources: this.resources,
      UserUnit: this.userUnit
    });
    this.markings = [];
  }

  // Lazily create these objects
  get fonts() {
    const data = this.resources.data;
    return data.Font != null ? data.Font : data.Font = {};
  }
  get xobjects() {
    const data = this.resources.data;
    return data.XObject != null ? data.XObject : data.XObject = {};
  }
  get ext_gstates() {
    const data = this.resources.data;
    return data.ExtGState != null ? data.ExtGState : data.ExtGState = {};
  }
  get patterns() {
    const data = this.resources.data;
    return data.Pattern != null ? data.Pattern : data.Pattern = {};
  }
  get colorSpaces() {
    const data = this.resources.data;
    return data.ColorSpace || (data.ColorSpace = {});
  }
  get annotations() {
    const data = this.dictionary.data;
    return data.Annots != null ? data.Annots : data.Annots = [];
  }
  get structParentTreeKey() {
    const data = this.dictionary.data;
    return data.StructParents != null ? data.StructParents : data.StructParents = this.document.createStructParentTreeNextKey();
  }
  maxY() {
    return this.height - this.margins.bottom;
  }
  write(chunk) {
    return this.content.write(chunk);
  }
  end() {
    this.dictionary.end();
    this.resources.end();
    return this.content.end();
  }
}

const wordArrayToBuffer = wordArray => {
  const byteArray = [];
  for (let i = 0; i < wordArray.sigBytes; i++) {
    byteArray.push(wordArray.words[Math.floor(i / 4)] >> 8 * (3 - i % 4) & 0xff);
  }
  return Buffer$2.from(byteArray);
};
class PDFSecurity {
  static generateFileID(info) {
    if (info === void 0) {
      info = {};
    }
    let infoStr = `${info.CreationDate.getTime()}\n`;
    for (let key in info) {
      if (!info.hasOwnProperty(key)) continue;
      infoStr += `${key}: ${info[key].valueOf()}\n`;
    }
    return wordArrayToBuffer(MD5(infoStr));
  }
}

const {
  number: number$2
} = PDFObject$1;
let PDFGradient$1 = class PDFGradient {
  constructor(doc) {
    this.doc = doc;
    this.stops = [];
    this.embedded = false;
    this.transform = [1, 0, 0, 1, 0, 0];
  }
  stop(pos, color, opacity) {
    if (opacity == null) {
      opacity = 1;
    }
    color = this.doc._normalizeColor(color);
    if (this.stops.length === 0) {
      if (color.length === 3) {
        this._colorSpace = 'DeviceRGB';
      } else if (color.length === 4) {
        this._colorSpace = 'DeviceCMYK';
      } else if (color.length === 1) {
        this._colorSpace = 'DeviceGray';
      } else {
        throw new Error('Unknown color space');
      }
    } else if (this._colorSpace === 'DeviceRGB' && color.length !== 3 || this._colorSpace === 'DeviceCMYK' && color.length !== 4 || this._colorSpace === 'DeviceGray' && color.length !== 1) {
      throw new Error('All gradient stops must use the same color space');
    }
    opacity = Math.max(0, Math.min(1, opacity));
    this.stops.push([pos, color, opacity]);
    return this;
  }
  setTransform(m11, m12, m21, m22, dx, dy) {
    this.transform = [m11, m12, m21, m22, dx, dy];
    return this;
  }
  embed(m) {
    let fn;
    const stopsLength = this.stops.length;
    if (stopsLength === 0) {
      return;
    }
    this.embedded = true;
    this.matrix = m;

    // if the last stop comes before 100%, add a copy at 100%
    const last = this.stops[stopsLength - 1];
    if (last[0] < 1) {
      this.stops.push([1, last[1], last[2]]);
    }
    const bounds = [];
    const encode = [];
    const stops = [];
    for (let i = 0; i < stopsLength - 1; i++) {
      encode.push(0, 1);
      if (i + 2 !== stopsLength) {
        bounds.push(this.stops[i + 1][0]);
      }
      fn = this.doc.ref({
        FunctionType: 2,
        Domain: [0, 1],
        C0: this.stops[i + 0][1],
        C1: this.stops[i + 1][1],
        N: 1
      });
      stops.push(fn);
      fn.end();
    }

    // if there are only two stops, we don't need a stitching function
    if (stopsLength === 1) {
      fn = stops[0];
    } else {
      fn = this.doc.ref({
        FunctionType: 3,
        // stitching function
        Domain: [0, 1],
        Functions: stops,
        Bounds: bounds,
        Encode: encode
      });
      fn.end();
    }
    this.id = `Sh${++this.doc._gradCount}`;
    const shader = this.shader(fn);
    shader.end();
    const pattern = this.doc.ref({
      Type: 'Pattern',
      PatternType: 2,
      Shading: shader,
      Matrix: this.matrix.map(number$2)
    });
    pattern.end();
    if (this.stops.some(stop => stop[2] < 1)) {
      let grad = this.opacityGradient();
      grad._colorSpace = 'DeviceGray';
      for (let stop of this.stops) {
        grad.stop(stop[0], [stop[2]]);
      }
      grad = grad.embed(this.matrix);
      const pageBBox = [0, 0, this.doc.page.width, this.doc.page.height];
      const form = this.doc.ref({
        Type: 'XObject',
        Subtype: 'Form',
        FormType: 1,
        BBox: pageBBox,
        Group: {
          Type: 'Group',
          S: 'Transparency',
          CS: 'DeviceGray'
        },
        Resources: {
          ProcSet: ['PDF', 'Text', 'ImageB', 'ImageC', 'ImageI'],
          Pattern: {
            Sh1: grad
          }
        }
      });
      form.write('/Pattern cs /Sh1 scn');
      form.end(`${pageBBox.join(' ')} re f`);
      const gstate = this.doc.ref({
        Type: 'ExtGState',
        SMask: {
          Type: 'Mask',
          S: 'Luminosity',
          G: form
        }
      });
      gstate.end();
      const opacityPattern = this.doc.ref({
        Type: 'Pattern',
        PatternType: 1,
        PaintType: 1,
        TilingType: 2,
        BBox: pageBBox,
        XStep: pageBBox[2],
        YStep: pageBBox[3],
        Resources: {
          ProcSet: ['PDF', 'Text', 'ImageB', 'ImageC', 'ImageI'],
          Pattern: {
            Sh1: pattern
          },
          ExtGState: {
            Gs1: gstate
          }
        }
      });
      opacityPattern.write('/Gs1 gs /Pattern cs /Sh1 scn');
      opacityPattern.end(`${pageBBox.join(' ')} re f`);
      this.doc.page.patterns[this.id] = opacityPattern;
    } else {
      this.doc.page.patterns[this.id] = pattern;
    }
    return pattern;
  }
  apply(stroke) {
    // apply gradient transform to existing document ctm
    const [m0, m1, m2, m3, m4, m5] = this.doc._ctm;
    const [m11, m12, m21, m22, dx, dy] = this.transform;
    const m = [m0 * m11 + m2 * m12, m1 * m11 + m3 * m12, m0 * m21 + m2 * m22, m1 * m21 + m3 * m22, m0 * dx + m2 * dy + m4, m1 * dx + m3 * dy + m5];
    if (!this.embedded || m.join(' ') !== this.matrix.join(' ')) {
      this.embed(m);
    }
    this.doc._setColorSpace('Pattern', stroke);
    const op = stroke ? 'SCN' : 'scn';
    return this.doc.addContent(`/${this.id} ${op}`);
  }
};
let PDFLinearGradient$1 = class PDFLinearGradient extends PDFGradient$1 {
  constructor(doc, x1, y1, x2, y2) {
    super(doc);
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }
  shader(fn) {
    return this.doc.ref({
      ShadingType: 2,
      ColorSpace: this._colorSpace,
      Coords: [this.x1, this.y1, this.x2, this.y2],
      Function: fn,
      Extend: [true, true]
    });
  }
  opacityGradient() {
    return new PDFLinearGradient(this.doc, this.x1, this.y1, this.x2, this.y2);
  }
};
let PDFRadialGradient$1 = class PDFRadialGradient extends PDFGradient$1 {
  constructor(doc, x1, y1, r1, x2, y2, r2) {
    super(doc);
    this.doc = doc;
    this.x1 = x1;
    this.y1 = y1;
    this.r1 = r1;
    this.x2 = x2;
    this.y2 = y2;
    this.r2 = r2;
  }
  shader(fn) {
    return this.doc.ref({
      ShadingType: 3,
      ColorSpace: this._colorSpace,
      Coords: [this.x1, this.y1, this.r1, this.x2, this.y2, this.r2],
      Function: fn,
      Extend: [true, true]
    });
  }
  opacityGradient() {
    return new PDFRadialGradient(this.doc, this.x1, this.y1, this.r1, this.x2, this.y2, this.r2);
  }
};
var Gradient = {
  PDFGradient: PDFGradient$1,
  PDFLinearGradient: PDFLinearGradient$1,
  PDFRadialGradient: PDFRadialGradient$1
};

/*
PDF tiling pattern support. Uncolored only.
 */

const underlyingColorSpaces = ['DeviceCMYK', 'DeviceRGB'];
let PDFTilingPattern$1 = class PDFTilingPattern {
  constructor(doc, bBox, xStep, yStep, stream) {
    this.doc = doc;
    this.bBox = bBox;
    this.xStep = xStep;
    this.yStep = yStep;
    this.stream = stream;
  }
  createPattern() {
    // no resources needed for our current usage
    // required entry
    const resources = this.doc.ref();
    resources.end();
    // apply default transform matrix (flipped in the default doc._ctm)
    // see document.js & gradient.js
    const [m0, m1, m2, m3, m4, m5] = this.doc._ctm;
    const [m11, m12, m21, m22, dx, dy] = [1, 0, 0, 1, 0, 0];
    const m = [m0 * m11 + m2 * m12, m1 * m11 + m3 * m12, m0 * m21 + m2 * m22, m1 * m21 + m3 * m22, m0 * dx + m2 * dy + m4, m1 * dx + m3 * dy + m5];
    const pattern = this.doc.ref({
      Type: 'Pattern',
      PatternType: 1,
      // tiling
      PaintType: 2,
      // 1-colored, 2-uncolored
      TilingType: 2,
      // 2-no distortion
      BBox: this.bBox,
      XStep: this.xStep,
      YStep: this.yStep,
      Matrix: m.map(v => +v.toFixed(5)),
      Resources: resources
    });
    pattern.end(this.stream);
    return pattern;
  }
  embedPatternColorSpaces() {
    // map each pattern to an underlying color space
    // and embed on each page
    underlyingColorSpaces.forEach(csName => {
      const csId = this.getPatternColorSpaceId(csName);
      if (this.doc.page.colorSpaces[csId]) return;
      const cs = this.doc.ref(['Pattern', csName]);
      cs.end();
      this.doc.page.colorSpaces[csId] = cs;
    });
  }
  getPatternColorSpaceId(underlyingColorspace) {
    return `CsP${underlyingColorspace}`;
  }
  embed() {
    if (!this.id) {
      this.doc._patternCount = this.doc._patternCount + 1;
      this.id = 'P' + this.doc._patternCount;
      this.pattern = this.createPattern();
    }

    // patterns are embedded in each page
    if (!this.doc.page.patterns[this.id]) {
      this.doc.page.patterns[this.id] = this.pattern;
    }
  }
  apply(stroke, patternColor) {
    // do any embedding/creating that might be needed
    this.embedPatternColorSpaces();
    this.embed();
    const normalizedColor = this.doc._normalizeColor(patternColor);
    if (!normalizedColor) throw Error(`invalid pattern color. (value: ${patternColor})`);

    // select one of the pattern color spaces
    const csId = this.getPatternColorSpaceId(this.doc._getColorSpace(normalizedColor));
    this.doc._setColorSpace(csId, stroke);

    // stroke/fill using the pattern and color (in the above underlying color space)
    const op = stroke ? 'SCN' : 'scn';
    return this.doc.addContent(`${normalizedColor.join(' ')} /${this.id} ${op}`);
  }
};
var pattern = {
  PDFTilingPattern: PDFTilingPattern$1
};

const {
  PDFGradient,
  PDFLinearGradient,
  PDFRadialGradient
} = Gradient;
const {
  PDFTilingPattern
} = pattern;
var ColorMixin = {
  initColor() {
    // The opacity dictionaries
    this._opacityRegistry = {};
    this._opacityCount = 0;
    this._patternCount = 0;
    return this._gradCount = 0;
  },
  _normalizeColor(color) {
    if (typeof color === 'string') {
      if (color.charAt(0) === '#') {
        if (color.length === 4) {
          color = color.replace(/#([0-9A-F])([0-9A-F])([0-9A-F])/i, '#$1$1$2$2$3$3');
        }
        const hex = parseInt(color.slice(1), 16);
        color = [hex >> 16, hex >> 8 & 0xff, hex & 0xff];
      } else if (namedColors[color]) {
        color = namedColors[color];
      }
    }
    if (Array.isArray(color)) {
      // RGB
      if (color.length === 3) {
        color = color.map(part => part / 255);
        // CMYK
      } else if (color.length === 4) {
        color = color.map(part => part / 100);
      }
      return color;
    }
    return null;
  },
  _setColor(color, stroke) {
    if (color instanceof PDFGradient) {
      color.apply(stroke);
      return true;
      // see if tiling pattern, decode & apply it it
    } else if (Array.isArray(color) && color[0] instanceof PDFTilingPattern) {
      color[0].apply(stroke, color[1]);
      return true;
    }
    // any other case should be a normal color and not a pattern
    return this._setColorCore(color, stroke);
  },
  _setColorCore(color, stroke) {
    color = this._normalizeColor(color);
    if (!color) {
      return false;
    }
    const op = stroke ? 'SCN' : 'scn';
    const space = this._getColorSpace(color);
    this._setColorSpace(space, stroke);
    color = color.join(' ');
    this.addContent(`${color} ${op}`);
    return true;
  },
  _setColorSpace(space, stroke) {
    const op = stroke ? 'CS' : 'cs';
    return this.addContent(`/${space} ${op}`);
  },
  _getColorSpace(color) {
    return color.length === 4 ? 'DeviceCMYK' : 'DeviceRGB';
  },
  fillColor(color, opacity) {
    const set = this._setColor(color, false);
    if (set) {
      this.fillOpacity(opacity);
    }

    // save this for text wrapper, which needs to reset
    // the fill color on new pages
    this._fillColor = [color, opacity];
    return this;
  },
  strokeColor(color, opacity) {
    const set = this._setColor(color, true);
    if (set) {
      this.strokeOpacity(opacity);
    }
    return this;
  },
  opacity(opacity) {
    this._doOpacity(opacity, opacity);
    return this;
  },
  fillOpacity(opacity) {
    this._doOpacity(opacity, null);
    return this;
  },
  strokeOpacity(opacity) {
    this._doOpacity(null, opacity);
    return this;
  },
  _doOpacity(fillOpacity, strokeOpacity) {
    let dictionary, name;
    if (fillOpacity == null && strokeOpacity == null) {
      return;
    }
    if (fillOpacity != null) {
      fillOpacity = Math.max(0, Math.min(1, fillOpacity));
    }
    if (strokeOpacity != null) {
      strokeOpacity = Math.max(0, Math.min(1, strokeOpacity));
    }
    const key = `${fillOpacity}_${strokeOpacity}`;
    if (this._opacityRegistry[key]) {
      [dictionary, name] = this._opacityRegistry[key];
    } else {
      dictionary = {
        Type: 'ExtGState'
      };
      if (fillOpacity != null) {
        dictionary.ca = fillOpacity;
      }
      if (strokeOpacity != null) {
        dictionary.CA = strokeOpacity;
      }
      dictionary = this.ref(dictionary);
      dictionary.end();
      const id = ++this._opacityCount;
      name = `Gs${id}`;
      this._opacityRegistry[key] = [dictionary, name];
    }
    this.page.ext_gstates[name] = dictionary;
    return this.addContent(`/${name} gs`);
  },
  linearGradient(x1, y1, x2, y2) {
    return new PDFLinearGradient(this, x1, y1, x2, y2);
  },
  radialGradient(x1, y1, r1, x2, y2, r2) {
    return new PDFRadialGradient(this, x1, y1, r1, x2, y2, r2);
  },
  pattern(bbox, xStep, yStep, stream) {
    return new PDFTilingPattern(this, bbox, xStep, yStep, stream);
  }
};
var namedColors = {
  aliceblue: [240, 248, 255],
  antiquewhite: [250, 235, 215],
  aqua: [0, 255, 255],
  aquamarine: [127, 255, 212],
  azure: [240, 255, 255],
  beige: [245, 245, 220],
  bisque: [255, 228, 196],
  black: [0, 0, 0],
  blanchedalmond: [255, 235, 205],
  blue: [0, 0, 255],
  blueviolet: [138, 43, 226],
  brown: [165, 42, 42],
  burlywood: [222, 184, 135],
  cadetblue: [95, 158, 160],
  chartreuse: [127, 255, 0],
  chocolate: [210, 105, 30],
  coral: [255, 127, 80],
  cornflowerblue: [100, 149, 237],
  cornsilk: [255, 248, 220],
  crimson: [220, 20, 60],
  cyan: [0, 255, 255],
  darkblue: [0, 0, 139],
  darkcyan: [0, 139, 139],
  darkgoldenrod: [184, 134, 11],
  darkgray: [169, 169, 169],
  darkgreen: [0, 100, 0],
  darkgrey: [169, 169, 169],
  darkkhaki: [189, 183, 107],
  darkmagenta: [139, 0, 139],
  darkolivegreen: [85, 107, 47],
  darkorange: [255, 140, 0],
  darkorchid: [153, 50, 204],
  darkred: [139, 0, 0],
  darksalmon: [233, 150, 122],
  darkseagreen: [143, 188, 143],
  darkslateblue: [72, 61, 139],
  darkslategray: [47, 79, 79],
  darkslategrey: [47, 79, 79],
  darkturquoise: [0, 206, 209],
  darkviolet: [148, 0, 211],
  deeppink: [255, 20, 147],
  deepskyblue: [0, 191, 255],
  dimgray: [105, 105, 105],
  dimgrey: [105, 105, 105],
  dodgerblue: [30, 144, 255],
  firebrick: [178, 34, 34],
  floralwhite: [255, 250, 240],
  forestgreen: [34, 139, 34],
  fuchsia: [255, 0, 255],
  gainsboro: [220, 220, 220],
  ghostwhite: [248, 248, 255],
  gold: [255, 215, 0],
  goldenrod: [218, 165, 32],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
  green: [0, 128, 0],
  greenyellow: [173, 255, 47],
  honeydew: [240, 255, 240],
  hotpink: [255, 105, 180],
  indianred: [205, 92, 92],
  indigo: [75, 0, 130],
  ivory: [255, 255, 240],
  khaki: [240, 230, 140],
  lavender: [230, 230, 250],
  lavenderblush: [255, 240, 245],
  lawngreen: [124, 252, 0],
  lemonchiffon: [255, 250, 205],
  lightblue: [173, 216, 230],
  lightcoral: [240, 128, 128],
  lightcyan: [224, 255, 255],
  lightgoldenrodyellow: [250, 250, 210],
  lightgray: [211, 211, 211],
  lightgreen: [144, 238, 144],
  lightgrey: [211, 211, 211],
  lightpink: [255, 182, 193],
  lightsalmon: [255, 160, 122],
  lightseagreen: [32, 178, 170],
  lightskyblue: [135, 206, 250],
  lightslategray: [119, 136, 153],
  lightslategrey: [119, 136, 153],
  lightsteelblue: [176, 196, 222],
  lightyellow: [255, 255, 224],
  lime: [0, 255, 0],
  limegreen: [50, 205, 50],
  linen: [250, 240, 230],
  magenta: [255, 0, 255],
  maroon: [128, 0, 0],
  mediumaquamarine: [102, 205, 170],
  mediumblue: [0, 0, 205],
  mediumorchid: [186, 85, 211],
  mediumpurple: [147, 112, 219],
  mediumseagreen: [60, 179, 113],
  mediumslateblue: [123, 104, 238],
  mediumspringgreen: [0, 250, 154],
  mediumturquoise: [72, 209, 204],
  mediumvioletred: [199, 21, 133],
  midnightblue: [25, 25, 112],
  mintcream: [245, 255, 250],
  mistyrose: [255, 228, 225],
  moccasin: [255, 228, 181],
  navajowhite: [255, 222, 173],
  navy: [0, 0, 128],
  oldlace: [253, 245, 230],
  olive: [128, 128, 0],
  olivedrab: [107, 142, 35],
  orange: [255, 165, 0],
  orangered: [255, 69, 0],
  orchid: [218, 112, 214],
  palegoldenrod: [238, 232, 170],
  palegreen: [152, 251, 152],
  paleturquoise: [175, 238, 238],
  palevioletred: [219, 112, 147],
  papayawhip: [255, 239, 213],
  peachpuff: [255, 218, 185],
  peru: [205, 133, 63],
  pink: [255, 192, 203],
  plum: [221, 160, 221],
  powderblue: [176, 224, 230],
  purple: [128, 0, 128],
  red: [255, 0, 0],
  rosybrown: [188, 143, 143],
  royalblue: [65, 105, 225],
  saddlebrown: [139, 69, 19],
  salmon: [250, 128, 114],
  sandybrown: [244, 164, 96],
  seagreen: [46, 139, 87],
  seashell: [255, 245, 238],
  sienna: [160, 82, 45],
  silver: [192, 192, 192],
  skyblue: [135, 206, 235],
  slateblue: [106, 90, 205],
  slategray: [112, 128, 144],
  slategrey: [112, 128, 144],
  snow: [255, 250, 250],
  springgreen: [0, 255, 127],
  steelblue: [70, 130, 180],
  tan: [210, 180, 140],
  teal: [0, 128, 128],
  thistle: [216, 191, 216],
  tomato: [255, 99, 71],
  turquoise: [64, 224, 208],
  violet: [238, 130, 238],
  wheat: [245, 222, 179],
  white: [255, 255, 255],
  whitesmoke: [245, 245, 245],
  yellow: [255, 255, 0],
  yellowgreen: [154, 205, 50]
};

/* eslint-disable no-lonely-if */
let cx;
let cy;
let px;
let py;
let sx;
let sy;
cx = cy = px = py = sx = sy = 0;

// parseDataPath copy pasted from svgo
// https://github.com/svg/svgo/blob/e4918ccdd1a2b5831defe0f00c1286744b479448/lib/path.js

/**
 * @typedef {'M' | 'm' | 'Z' | 'z' | 'L' | 'l' | 'H' | 'h' | 'V' | 'v' | 'C' | 'c' | 'S' | 's' | 'Q' | 'q' | 'T' | 't' | 'A' | 'a'} PathDataCommand
 */

/**
 * @typedef {Object} PathDataItem
 * @property {PathDataCommand} command
 * @property {number[]} args
 */

const argsCountPerCommand = {
  M: 2,
  m: 2,
  Z: 0,
  z: 0,
  L: 2,
  l: 2,
  H: 1,
  h: 1,
  V: 1,
  v: 1,
  C: 6,
  c: 6,
  S: 4,
  s: 4,
  Q: 4,
  q: 4,
  T: 2,
  t: 2,
  A: 7,
  a: 7
};

/**
 * @type {(c: string) => c is PathDataCommand}
 */
const isCommand = c => {
  return c in argsCountPerCommand;
};

/**
 * @type {(c: string) => boolean}
 */
const isWsp = c => {
  const codePoint = c.codePointAt(0);
  return codePoint === 0x20 || codePoint === 0x9 || codePoint === 0xd || codePoint === 0xa;
};

/**
 * @type {(c: string) => boolean}
 */
const isDigit = c => {
  const codePoint = c.codePointAt(0);
  if (codePoint == null) {
    return false;
  }
  return 48 <= codePoint && codePoint <= 57;
};

/**
 * @typedef {'none' | 'sign' | 'whole' | 'decimal_point' | 'decimal' | 'e' | 'exponent_sign' | 'exponent'} ReadNumberState
 */

/**
 * @type {(string: string, cursor: number) => [number, number | null]}
 */
const readNumber = (string, cursor) => {
  let i = cursor;
  let value = '';
  let state = /** @type {ReadNumberState} */'none';
  for (; i < string.length; i += 1) {
    const c = string[i];
    if (c === '+' || c === '-') {
      if (state === 'none') {
        state = 'sign';
        value += c;
        continue;
      }
      if (state === 'e') {
        state = 'exponent_sign';
        value += c;
        continue;
      }
    }
    if (isDigit(c)) {
      if (state === 'none' || state === 'sign' || state === 'whole') {
        state = 'whole';
        value += c;
        continue;
      }
      if (state === 'decimal_point' || state === 'decimal') {
        state = 'decimal';
        value += c;
        continue;
      }
      if (state === 'e' || state === 'exponent_sign' || state === 'exponent') {
        state = 'exponent';
        value += c;
        continue;
      }
    }
    if (c === '.') {
      if (state === 'none' || state === 'sign' || state === 'whole') {
        state = 'decimal_point';
        value += c;
        continue;
      }
    }
    if (c === 'E' || c === 'e') {
      if (state === 'whole' || state === 'decimal_point' || state === 'decimal') {
        state = 'e';
        value += c;
        continue;
      }
    }
    break;
  }
  const number = Number.parseFloat(value);
  if (Number.isNaN(number)) {
    return [cursor, null];
  }
  // step back to delegate iteration to parent loop
  return [i - 1, number];
};

/**
 * @type {(string: string) => Array<PathDataItem>}
 */
const parsePathData = string => {
  /**
   * @type {Array<PathDataItem>}
   */
  const pathData = [];
  /**
   * @type {null | PathDataCommand}
   */
  let command = null;
  let args = /** @type {number[]} */[];
  let argsCount = 0;
  let canHaveComma = false;
  let hadComma = false;
  for (let i = 0; i < string.length; i += 1) {
    const c = string.charAt(i);
    if (isWsp(c)) {
      continue;
    }
    // allow comma only between arguments
    if (canHaveComma && c === ',') {
      if (hadComma) {
        break;
      }
      hadComma = true;
      continue;
    }
    if (isCommand(c)) {
      if (hadComma) {
        return pathData;
      }
      if (command == null) {
        // moveto should be leading command
        if (c !== 'M' && c !== 'm') {
          return pathData;
        }
      } else {
        // stop if previous command arguments are not flushed
        if (args.length !== 0) {
          return pathData;
        }
      }
      command = c;
      args = [];
      argsCount = argsCountPerCommand[command];
      canHaveComma = false;
      // flush command without arguments
      if (argsCount === 0) {
        pathData.push({
          command,
          args
        });
      }
      continue;
    }
    // avoid parsing arguments if no command detected
    if (command == null) {
      return pathData;
    }
    // read next argument
    let newCursor = i;
    let number = null;
    if (command === 'A' || command === 'a') {
      const position = args.length;
      if (position === 0 || position === 1) {
        // allow only positive number without sign as first two arguments
        if (c !== '+' && c !== '-') {
          [newCursor, number] = readNumber(string, i);
        }
      }
      if (position === 2 || position === 5 || position === 6) {
        [newCursor, number] = readNumber(string, i);
      }
      if (position === 3 || position === 4) {
        // read flags
        if (c === '0') {
          number = 0;
        }
        if (c === '1') {
          number = 1;
        }
      }
    } else {
      [newCursor, number] = readNumber(string, i);
    }
    if (number == null) {
      return pathData;
    }
    args.push(number);
    canHaveComma = true;
    hadComma = false;
    i = newCursor;
    // flush arguments when necessary count is reached
    if (args.length === argsCount) {
      pathData.push({
        command,
        args
      });
      // subsequent moveto coordinates are threated as implicit lineto commands
      if (command === 'M') {
        command = 'L';
      }
      if (command === 'm') {
        command = 'l';
      }
      args = [];
    }
  }
  return pathData;
};
const apply = function (commands, doc) {
  // current point, control point, and subpath starting point
  cx = cy = px = py = sx = sy = 0;

  // run the commands
  for (let i = 0; i < commands.length; i++) {
    const {
      command,
      args
    } = commands[i];
    if (typeof runners[command] === 'function') {
      runners[command](doc, args);
    }
  }
};
const runners = {
  M(doc, a) {
    cx = a[0];
    cy = a[1];
    px = py = null;
    sx = cx;
    sy = cy;
    return doc.moveTo(cx, cy);
  },
  m(doc, a) {
    cx += a[0];
    cy += a[1];
    px = py = null;
    sx = cx;
    sy = cy;
    return doc.moveTo(cx, cy);
  },
  C(doc, a) {
    cx = a[4];
    cy = a[5];
    px = a[2];
    py = a[3];
    return doc.bezierCurveTo(...a);
  },
  c(doc, a) {
    doc.bezierCurveTo(a[0] + cx, a[1] + cy, a[2] + cx, a[3] + cy, a[4] + cx, a[5] + cy);
    px = cx + a[2];
    py = cy + a[3];
    cx += a[4];
    return cy += a[5];
  },
  S(doc, a) {
    if (px === null) {
      px = cx;
      py = cy;
    }
    doc.bezierCurveTo(cx - (px - cx), cy - (py - cy), a[0], a[1], a[2], a[3]);
    px = a[0];
    py = a[1];
    cx = a[2];
    return cy = a[3];
  },
  s(doc, a) {
    if (px === null) {
      px = cx;
      py = cy;
    }
    doc.bezierCurveTo(cx - (px - cx), cy - (py - cy), cx + a[0], cy + a[1], cx + a[2], cy + a[3]);
    px = cx + a[0];
    py = cy + a[1];
    cx += a[2];
    return cy += a[3];
  },
  Q(doc, a) {
    px = a[0];
    py = a[1];
    cx = a[2];
    cy = a[3];
    return doc.quadraticCurveTo(a[0], a[1], cx, cy);
  },
  q(doc, a) {
    doc.quadraticCurveTo(a[0] + cx, a[1] + cy, a[2] + cx, a[3] + cy);
    px = cx + a[0];
    py = cy + a[1];
    cx += a[2];
    return cy += a[3];
  },
  T(doc, a) {
    if (px === null) {
      px = cx;
      py = cy;
    } else {
      px = cx - (px - cx);
      py = cy - (py - cy);
    }
    doc.quadraticCurveTo(px, py, a[0], a[1]);
    px = cx - (px - cx);
    py = cy - (py - cy);
    cx = a[0];
    return cy = a[1];
  },
  t(doc, a) {
    if (px === null) {
      px = cx;
      py = cy;
    } else {
      px = cx - (px - cx);
      py = cy - (py - cy);
    }
    doc.quadraticCurveTo(px, py, cx + a[0], cy + a[1]);
    cx += a[0];
    return cy += a[1];
  },
  A(doc, a) {
    solveArc(doc, cx, cy, a);
    cx = a[5];
    return cy = a[6];
  },
  a(doc, a) {
    a[5] += cx;
    a[6] += cy;
    solveArc(doc, cx, cy, a);
    cx = a[5];
    return cy = a[6];
  },
  L(doc, a) {
    cx = a[0];
    cy = a[1];
    px = py = null;
    return doc.lineTo(cx, cy);
  },
  l(doc, a) {
    cx += a[0];
    cy += a[1];
    px = py = null;
    return doc.lineTo(cx, cy);
  },
  H(doc, a) {
    cx = a[0];
    px = py = null;
    return doc.lineTo(cx, cy);
  },
  h(doc, a) {
    cx += a[0];
    px = py = null;
    return doc.lineTo(cx, cy);
  },
  V(doc, a) {
    cy = a[0];
    px = py = null;
    return doc.lineTo(cx, cy);
  },
  v(doc, a) {
    cy += a[0];
    px = py = null;
    return doc.lineTo(cx, cy);
  },
  Z(doc) {
    doc.closePath();
    cx = sx;
    return cy = sy;
  },
  z(doc) {
    doc.closePath();
    cx = sx;
    return cy = sy;
  }
};
const solveArc = function (doc, x, y, coords) {
  const [rx, ry, rot, large, sweep, ex, ey] = coords;
  const segs = arcToSegments(ex, ey, rx, ry, large, sweep, rot, x, y);
  for (let seg of segs) {
    const bez = segmentToBezier(...seg);
    doc.bezierCurveTo(...bez);
  }
};

// from Inkscape svgtopdf, thanks!
const arcToSegments = function (x, y, rx, ry, large, sweep, rotateX, ox, oy) {
  const th = rotateX * (Math.PI / 180);
  const sin_th = Math.sin(th);
  const cos_th = Math.cos(th);
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  px = cos_th * (ox - x) * 0.5 + sin_th * (oy - y) * 0.5;
  py = cos_th * (oy - y) * 0.5 - sin_th * (ox - x) * 0.5;
  let pl = px * px / (rx * rx) + py * py / (ry * ry);
  if (pl > 1) {
    pl = Math.sqrt(pl);
    rx *= pl;
    ry *= pl;
  }
  const a00 = cos_th / rx;
  const a01 = sin_th / rx;
  const a10 = -sin_th / ry;
  const a11 = cos_th / ry;
  const x0 = a00 * ox + a01 * oy;
  const y0 = a10 * ox + a11 * oy;
  const x1 = a00 * x + a01 * y;
  const y1 = a10 * x + a11 * y;
  const d = (x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0);
  let sfactor_sq = 1 / d - 0.25;
  if (sfactor_sq < 0) {
    sfactor_sq = 0;
  }
  let sfactor = Math.sqrt(sfactor_sq);
  if (sweep === large) {
    sfactor = -sfactor;
  }
  const xc = 0.5 * (x0 + x1) - sfactor * (y1 - y0);
  const yc = 0.5 * (y0 + y1) + sfactor * (x1 - x0);
  const th0 = Math.atan2(y0 - yc, x0 - xc);
  const th1 = Math.atan2(y1 - yc, x1 - xc);
  let th_arc = th1 - th0;
  if (th_arc < 0 && sweep === 1) {
    th_arc += 2 * Math.PI;
  } else if (th_arc > 0 && sweep === 0) {
    th_arc -= 2 * Math.PI;
  }
  const segments = Math.ceil(Math.abs(th_arc / (Math.PI * 0.5 + 0.001)));
  const result = [];
  for (let i = 0; i < segments; i++) {
    const th2 = th0 + i * th_arc / segments;
    const th3 = th0 + (i + 1) * th_arc / segments;
    result[i] = [xc, yc, th2, th3, rx, ry, sin_th, cos_th];
  }
  return result;
};
const segmentToBezier = function (cx, cy, th0, th1, rx, ry, sin_th, cos_th) {
  const a00 = cos_th * rx;
  const a01 = -sin_th * ry;
  const a10 = sin_th * rx;
  const a11 = cos_th * ry;
  const th_half = 0.5 * (th1 - th0);
  const t = 8 / 3 * Math.sin(th_half * 0.5) * Math.sin(th_half * 0.5) / Math.sin(th_half);
  const x1 = cx + Math.cos(th0) - t * Math.sin(th0);
  const y1 = cy + Math.sin(th0) + t * Math.cos(th0);
  const x3 = cx + Math.cos(th1);
  const y3 = cy + Math.sin(th1);
  const x2 = x3 + t * Math.sin(th1);
  const y2 = y3 - t * Math.cos(th1);
  return [a00 * x1 + a01 * y1, a10 * x1 + a11 * y1, a00 * x2 + a01 * y2, a10 * x2 + a11 * y2, a00 * x3 + a01 * y3, a10 * x3 + a11 * y3];
};
class SVGPath {
  static apply(doc, path) {
    const commands = parsePathData(path);
    apply(commands, doc);
  }
}

const {
  number: number$1
} = PDFObject$1;

// This constant is used to approximate a symmetrical arc using a cubic
// Bezier curve.
const KAPPA = 4.0 * ((Math.sqrt(2) - 1.0) / 3.0);
var VectorMixin = {
  initVector() {
    this._ctm = [1, 0, 0, 1, 0, 0]; // current transformation matrix
    return this._ctmStack = [];
  },
  save() {
    this._ctmStack.push(this._ctm.slice());
    // TODO: save/restore colorspace and styles so not setting it unnessesarily all the time?
    return this.addContent('q');
  },
  restore() {
    this._ctm = this._ctmStack.pop() || [1, 0, 0, 1, 0, 0];
    return this.addContent('Q');
  },
  closePath() {
    return this.addContent('h');
  },
  lineWidth(w) {
    return this.addContent(`${number$1(w)} w`);
  },
  _CAP_STYLES: {
    BUTT: 0,
    ROUND: 1,
    SQUARE: 2
  },
  lineCap(c) {
    if (typeof c === 'string') {
      c = this._CAP_STYLES[c.toUpperCase()];
    }
    return this.addContent(`${c} J`);
  },
  _JOIN_STYLES: {
    MITER: 0,
    ROUND: 1,
    BEVEL: 2
  },
  lineJoin(j) {
    if (typeof j === 'string') {
      j = this._JOIN_STYLES[j.toUpperCase()];
    }
    return this.addContent(`${j} j`);
  },
  miterLimit(m) {
    return this.addContent(`${number$1(m)} M`);
  },
  dash(length, options) {
    if (options === void 0) {
      options = {};
    }
    const originalLength = length;
    if (!Array.isArray(length)) {
      length = [length, options.space || length];
    }
    const valid = length.every(x => Number.isFinite(x) && x >= 0);
    if (!valid) {
      throw new Error(`dash(${JSON.stringify(originalLength)}, ${JSON.stringify(options)}) invalid, lengths must be numeric and greater than or equal to zero`);
    }
    length = length.map(number$1).join(' ');
    return this.addContent(`[${length}] ${number$1(options.phase || 0)} d`);
  },
  undash() {
    return this.addContent('[] 0 d');
  },
  moveTo(x, y) {
    return this.addContent(`${number$1(x)} ${number$1(y)} m`);
  },
  lineTo(x, y) {
    return this.addContent(`${number$1(x)} ${number$1(y)} l`);
  },
  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
    return this.addContent(`${number$1(cp1x)} ${number$1(cp1y)} ${number$1(cp2x)} ${number$1(cp2y)} ${number$1(x)} ${number$1(y)} c`);
  },
  quadraticCurveTo(cpx, cpy, x, y) {
    return this.addContent(`${number$1(cpx)} ${number$1(cpy)} ${number$1(x)} ${number$1(y)} v`);
  },
  rect(x, y, w, h) {
    return this.addContent(`${number$1(x)} ${number$1(y)} ${number$1(w)} ${number$1(h)} re`);
  },
  roundedRect(x, y, w, h, r) {
    if (r == null) {
      r = 0;
    }
    r = Math.min(r, 0.5 * w, 0.5 * h);

    // amount to inset control points from corners (see `ellipse`)
    const c = r * (1.0 - KAPPA);
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.bezierCurveTo(x + w - c, y, x + w, y + c, x + w, y + r);
    this.lineTo(x + w, y + h - r);
    this.bezierCurveTo(x + w, y + h - c, x + w - c, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h);
    this.bezierCurveTo(x + c, y + h, x, y + h - c, x, y + h - r);
    this.lineTo(x, y + r);
    this.bezierCurveTo(x, y + c, x + c, y, x + r, y);
    return this.closePath();
  },
  ellipse(x, y, r1, r2) {
    // based on http://stackoverflow.com/questions/2172798/how-to-draw-an-oval-in-html5-canvas/2173084#2173084
    if (r2 == null) {
      r2 = r1;
    }
    x -= r1;
    y -= r2;
    const ox = r1 * KAPPA;
    const oy = r2 * KAPPA;
    const xe = x + r1 * 2;
    const ye = y + r2 * 2;
    const xm = x + r1;
    const ym = y + r2;
    this.moveTo(x, ym);
    this.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
    this.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
    this.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
    this.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
    return this.closePath();
  },
  circle(x, y, radius) {
    return this.ellipse(x, y, radius);
  },
  arc(x, y, radius, startAngle, endAngle, anticlockwise) {
    if (anticlockwise == null) {
      anticlockwise = false;
    }
    const TWO_PI = 2.0 * Math.PI;
    const HALF_PI = 0.5 * Math.PI;
    let deltaAng = endAngle - startAngle;
    if (Math.abs(deltaAng) > TWO_PI) {
      // draw only full circle if more than that is specified
      deltaAng = TWO_PI;
    } else if (deltaAng !== 0 && anticlockwise !== deltaAng < 0) {
      // necessary to flip direction of rendering
      const dir = anticlockwise ? -1 : 1;
      deltaAng = dir * TWO_PI + deltaAng;
    }
    const numSegs = Math.ceil(Math.abs(deltaAng) / HALF_PI);
    const segAng = deltaAng / numSegs;
    const handleLen = segAng / HALF_PI * KAPPA * radius;
    let curAng = startAngle;

    // component distances between anchor point and control point
    let deltaCx = -Math.sin(curAng) * handleLen;
    let deltaCy = Math.cos(curAng) * handleLen;

    // anchor point
    let ax = x + Math.cos(curAng) * radius;
    let ay = y + Math.sin(curAng) * radius;

    // calculate and render segments
    this.moveTo(ax, ay);
    for (let segIdx = 0; segIdx < numSegs; segIdx++) {
      // starting control point
      const cp1x = ax + deltaCx;
      const cp1y = ay + deltaCy;

      // step angle
      curAng += segAng;

      // next anchor point
      ax = x + Math.cos(curAng) * radius;
      ay = y + Math.sin(curAng) * radius;

      // next control point delta
      deltaCx = -Math.sin(curAng) * handleLen;
      deltaCy = Math.cos(curAng) * handleLen;

      // ending control point
      const cp2x = ax - deltaCx;
      const cp2y = ay - deltaCy;

      // render segment
      this.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, ax, ay);
    }
    return this;
  },
  polygon() {
    for (var _len = arguments.length, points = new Array(_len), _key = 0; _key < _len; _key++) {
      points[_key] = arguments[_key];
    }
    this.moveTo(...(points.shift() || []));
    for (let point of points) {
      this.lineTo(...(point || []));
    }
    return this.closePath();
  },
  path(path) {
    SVGPath.apply(this, path);
    return this;
  },
  _windingRule(rule) {
    if (/even-?odd/.test(rule)) {
      return '*';
    }
    return '';
  },
  fill(color, rule) {
    if (/(even-?odd)|(non-?zero)/.test(color)) {
      rule = color;
      color = null;
    }
    if (color) {
      this.fillColor(color);
    }
    return this.addContent(`f${this._windingRule(rule)}`);
  },
  stroke(color) {
    if (color) {
      this.strokeColor(color);
    }
    return this.addContent('S');
  },
  fillAndStroke(fillColor, strokeColor, rule) {
    if (strokeColor == null) {
      strokeColor = fillColor;
    }
    const isFillRule = /(even-?odd)|(non-?zero)/;
    if (isFillRule.test(fillColor)) {
      rule = fillColor;
      fillColor = null;
    }
    if (isFillRule.test(strokeColor)) {
      rule = strokeColor;
      strokeColor = fillColor;
    }
    if (fillColor) {
      this.fillColor(fillColor);
      this.strokeColor(strokeColor);
    }
    return this.addContent(`B${this._windingRule(rule)}`);
  },
  clip(rule) {
    return this.addContent(`W${this._windingRule(rule)} n`);
  },
  transform(m11, m12, m21, m22, dx, dy) {
    // keep track of the current transformation matrix
    if (m11 === 1 && m12 === 0 && m21 === 0 && m22 === 1 && dx === 0 && dy === 0) {
      // Ignore identity transforms
      return this;
    }
    const m = this._ctm;
    const [m0, m1, m2, m3, m4, m5] = m;
    m[0] = m0 * m11 + m2 * m12;
    m[1] = m1 * m11 + m3 * m12;
    m[2] = m0 * m21 + m2 * m22;
    m[3] = m1 * m21 + m3 * m22;
    m[4] = m0 * dx + m2 * dy + m4;
    m[5] = m1 * dx + m3 * dy + m5;
    const values = [m11, m12, m21, m22, dx, dy].map(v => number$1(v)).join(' ');
    return this.addContent(`${values} cm`);
  },
  translate(x, y) {
    return this.transform(1, 0, 0, 1, x, y);
  },
  rotate(angle, options) {
    if (options === void 0) {
      options = {};
    }
    let y;
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    let x = y = 0;
    if (options.origin != null) {
      [x, y] = options.origin;
      const x1 = x * cos - y * sin;
      const y1 = x * sin + y * cos;
      x -= x1;
      y -= y1;
    }
    return this.transform(cos, sin, -sin, cos, x, y);
  },
  scale(xFactor, yFactor, options) {
    if (options === void 0) {
      options = {};
    }
    let y;
    if (yFactor == null) {
      yFactor = xFactor;
    }
    if (typeof yFactor === 'object') {
      options = yFactor;
      yFactor = xFactor;
    }
    let x = y = 0;
    if (options.origin != null) {
      [x, y] = options.origin;
      x -= xFactor * x;
      y -= yFactor * y;
    }
    return this.transform(xFactor, 0, 0, yFactor, x, y);
  }
};

var fs = {};

const range = (left, right, inclusive) => {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
};

/* eslint-disable no-var */
/* eslint-disable no-cond-assign */

const WIN_ANSI_MAP = {
  402: 131,
  8211: 150,
  8212: 151,
  8216: 145,
  8217: 146,
  8218: 130,
  8220: 147,
  8221: 148,
  8222: 132,
  8224: 134,
  8225: 135,
  8226: 149,
  8230: 133,
  8364: 128,
  8240: 137,
  8249: 139,
  8250: 155,
  710: 136,
  8482: 153,
  338: 140,
  339: 156,
  732: 152,
  352: 138,
  353: 154,
  376: 159,
  381: 142,
  382: 158
};
const characters = `\
.notdef       .notdef        .notdef        .notdef
.notdef       .notdef        .notdef        .notdef
.notdef       .notdef        .notdef        .notdef
.notdef       .notdef        .notdef        .notdef
.notdef       .notdef        .notdef        .notdef
.notdef       .notdef        .notdef        .notdef
.notdef       .notdef        .notdef        .notdef
.notdef       .notdef        .notdef        .notdef

space         exclam         quotedbl       numbersign
dollar        percent        ampersand      quotesingle
parenleft     parenright     asterisk       plus
comma         hyphen         period         slash
zero          one            two            three
four          five           six            seven
eight         nine           colon          semicolon
less          equal          greater        question

at            A              B              C
D             E              F              G
H             I              J              K
L             M              N              O
P             Q              R              S
T             U              V              W
X             Y              Z              bracketleft
backslash     bracketright   asciicircum    underscore

grave         a              b              c
d             e              f              g
h             i              j              k
l             m              n              o
p             q              r              s
t             u              v              w
x             y              z              braceleft
bar           braceright     asciitilde     .notdef

Euro          .notdef        quotesinglbase florin
quotedblbase  ellipsis       dagger         daggerdbl
circumflex    perthousand    Scaron         guilsinglleft
OE            .notdef        Zcaron         .notdef
.notdef       quoteleft      quoteright     quotedblleft
quotedblright bullet         endash         emdash
tilde         trademark      scaron         guilsinglright
oe            .notdef        zcaron         ydieresis

space         exclamdown     cent           sterling
currency      yen            brokenbar      section
dieresis      copyright      ordfeminine    guillemotleft
logicalnot    hyphen         registered     macron
degree        plusminus      twosuperior    threesuperior
acute         mu             paragraph      periodcentered
cedilla       onesuperior    ordmasculine   guillemotright
onequarter    onehalf        threequarters  questiondown

Agrave        Aacute         Acircumflex    Atilde
Adieresis     Aring          AE             Ccedilla
Egrave        Eacute         Ecircumflex    Edieresis
Igrave        Iacute         Icircumflex    Idieresis
Eth           Ntilde         Ograve         Oacute
Ocircumflex   Otilde         Odieresis      multiply
Oslash        Ugrave         Uacute         Ucircumflex
Udieresis     Yacute         Thorn          germandbls

agrave        aacute         acircumflex    atilde
adieresis     aring          ae             ccedilla
egrave        eacute         ecircumflex    edieresis
igrave        iacute         icircumflex    idieresis
eth           ntilde         ograve         oacute
ocircumflex   otilde         odieresis      divide
oslash        ugrave         uacute         ucircumflex
udieresis     yacute         thorn          ydieresis\
`.split(/\s+/);
function parse(contents) {
  const obj = {
    attributes: {},
    glyphWidths: {},
    kernPairs: {}
  };
  let section = '';
  for (let line of contents.split('\n')) {
    var match;
    var a;
    if (match = line.match(/^Start(\w+)/)) {
      section = match[1];
      continue;
    } else if (match = line.match(/^End(\w+)/)) {
      section = '';
      continue;
    }
    switch (section) {
      case 'FontMetrics':
        match = line.match(/(^\w+)\s+(.*)/);
        var key = match[1];
        var value = match[2];
        if (a = obj.attributes[key]) {
          if (!Array.isArray(a)) {
            a = obj.attributes[key] = [a];
          }
          a.push(value);
        } else {
          obj.attributes[key] = value;
        }
        break;
      case 'CharMetrics':
        if (!/^CH?\s/.test(line)) {
          continue;
        }
        var name = line.match(/\bN\s+(\.?\w+)\s*;/)[1];
        obj.glyphWidths[name] = +line.match(/\bWX\s+(\d+)\s*;/)[1];
        break;
      case 'KernPairs':
        match = line.match(/^KPX\s+(\.?\w+)\s+(\.?\w+)\s+(-?\d+)/);
        if (match) {
          obj.kernPairs[match[1] + match[2]] = parseInt(match[3]);
        }
        break;
    }
  }
  return obj;
}
class AFMFont {
  static open(filename) {
    {
      throw new Error('AFMFont.open not available on browser build');
    }
  }
  static fromJson(json) {
    return new AFMFont(json);
  }
  constructor(contents) {
    if (typeof contents === 'string') {
      this.contents = contents;
      this.parse();
    } else {
      this.attributes = contents.attributes;
      this.glyphWidths = contents.glyphWidths;
      this.kernPairs = contents.kernPairs;
    }
    this.charWidths = range(0, 255, true).map(i => this.glyphWidths[characters[i]]);
    this.bbox = Array.from(this.attributes.FontBBox.split(/\s+/)).map(e => +e);
    this.ascender = +(this.attributes.Ascender || 0);
    this.descender = +(this.attributes.Descender || 0);
    this.xHeight = +(this.attributes.XHeight || 0);
    this.capHeight = +(this.attributes.CapHeight || 0);
    this.lineGap = this.bbox[3] - this.bbox[1] - (this.ascender - this.descender);
  }
  parse() {
    const parsed = parse(this.contents);
    this.attributes = parsed.attributes;
    this.glyphWidths = parsed.glyphWidths;
    this.kernPairs = parsed.kernPairs;
  }
  encodeText(text) {
    const res = [];
    for (let i = 0, end = text.length, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
      let char = text.charCodeAt(i);
      char = WIN_ANSI_MAP[char] || char;
      res.push(char.toString(16));
    }
    return res;
  }
  glyphsForString(string) {
    const glyphs = [];
    for (let i = 0, end = string.length, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
      const charCode = string.charCodeAt(i);
      glyphs.push(this.characterToGlyph(charCode));
    }
    return glyphs;
  }
  characterToGlyph(character) {
    return characters[WIN_ANSI_MAP[character] || character] || '.notdef';
  }
  widthOfGlyph(glyph) {
    return this.glyphWidths[glyph] || 0;
  }
  getKernPair(left, right) {
    return this.kernPairs[left + right] || 0;
  }
  advancesForGlyphs(glyphs) {
    const advances = [];
    for (let index = 0; index < glyphs.length; index++) {
      const left = glyphs[index];
      const right = glyphs[index + 1];
      advances.push(this.widthOfGlyph(left) + this.getKernPair(left, right));
    }
    return advances;
  }
}

var attributes = [
	{
		Comment: [
			"Copyright (c) 1985, 1987, 1989, 1990, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
			"Creation Date: Thu May  1 12:43:52 1997",
			"UniqueID 43052",
			"VMusage 37169 48194"
		],
		FontName: "Helvetica-Bold",
		FullName: "Helvetica Bold",
		FamilyName: "Helvetica",
		Weight: "Bold",
		ItalicAngle: "0",
		IsFixedPitch: "false",
		CharacterSet: "ExtendedRoman",
		FontBBox: "-170 -228 1003 962 ",
		UnderlinePosition: "-100",
		UnderlineThickness: "50",
		Version: "002.000",
		Notice: "Copyright (c) 1985, 1987, 1989, 1990, 1997 Adobe Systems Incorporated.  All Rights Reserved.Helvetica is a trademark of Linotype-Hell AG and/or its subsidiaries.",
		EncodingScheme: "AdobeStandardEncoding",
		CapHeight: "718",
		XHeight: "532",
		Ascender: "718",
		Descender: "-207",
		StdHW: "118",
		StdVW: "140"
	},
	{
		Comment: [
			"Copyright (c) 1985, 1987, 1989, 1990, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
			"Creation Date: Thu May  1 12:45:12 1997",
			"UniqueID 43053",
			"VMusage 14482 68586"
		],
		FontName: "Helvetica-BoldOblique",
		FullName: "Helvetica Bold Oblique",
		FamilyName: "Helvetica",
		Weight: "Bold",
		ItalicAngle: "-12",
		IsFixedPitch: "false",
		CharacterSet: "ExtendedRoman",
		FontBBox: "-174 -228 1114 962",
		UnderlinePosition: "-100",
		UnderlineThickness: "50",
		Version: "002.000",
		Notice: "Copyright (c) 1985, 1987, 1989, 1990, 1997 Adobe Systems Incorporated.  All Rights Reserved.Helvetica is a trademark of Linotype-Hell AG and/or its subsidiaries.",
		EncodingScheme: "AdobeStandardEncoding",
		CapHeight: "718",
		XHeight: "532",
		Ascender: "718",
		Descender: "-207",
		StdHW: "118",
		StdVW: "140"
	},
	{
		Comment: [
			"Copyright (c) 1985, 1987, 1989, 1990, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
			"Creation Date: Thu May  1 12:44:31 1997",
			"UniqueID 43055",
			"VMusage 14960 69346"
		],
		FontName: "Helvetica-Oblique",
		FullName: "Helvetica Oblique",
		FamilyName: "Helvetica",
		Weight: "Medium",
		ItalicAngle: "-12",
		IsFixedPitch: "false",
		CharacterSet: "ExtendedRoman",
		FontBBox: "-170 -225 1116 931 ",
		UnderlinePosition: "-100",
		UnderlineThickness: "50",
		Version: "002.000",
		Notice: "Copyright (c) 1985, 1987, 1989, 1990, 1997 Adobe Systems Incorporated.  All Rights Reserved.Helvetica is a trademark of Linotype-Hell AG and/or its subsidiaries.",
		EncodingScheme: "AdobeStandardEncoding",
		CapHeight: "718",
		XHeight: "523",
		Ascender: "718",
		Descender: "-207",
		StdHW: "76",
		StdVW: "88"
	},
	{
		Comment: [
			"Copyright (c) 1985, 1987, 1989, 1990, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
			"Creation Date: Thu May  1 12:38:23 1997",
			"UniqueID 43054",
			"VMusage 37069 48094"
		],
		FontName: "Helvetica",
		FullName: "Helvetica",
		FamilyName: "Helvetica",
		Weight: "Medium",
		ItalicAngle: "0",
		IsFixedPitch: "false",
		CharacterSet: "ExtendedRoman",
		FontBBox: "-166 -225 1000 931 ",
		UnderlinePosition: "-100",
		UnderlineThickness: "50",
		Version: "002.000",
		Notice: "Copyright (c) 1985, 1987, 1989, 1990, 1997 Adobe Systems Incorporated.  All Rights Reserved.Helvetica is a trademark of Linotype-Hell AG and/or its subsidiaries.",
		EncodingScheme: "AdobeStandardEncoding",
		CapHeight: "718",
		XHeight: "523",
		Ascender: "718",
		Descender: "-207",
		StdHW: "76",
		StdVW: "88"
	},
	{
		Comment: [
			"Copyright (c) 1985, 1987, 1989, 1990, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
			"Creation Date: Thu May  1 12:52:56 1997",
			"UniqueID 43065",
			"VMusage 41636 52661"
		],
		FontName: "Times-Bold",
		FullName: "Times Bold",
		FamilyName: "Times",
		Weight: "Bold",
		ItalicAngle: "0",
		IsFixedPitch: "false",
		CharacterSet: "ExtendedRoman",
		FontBBox: "-168 -218 1000 935 ",
		UnderlinePosition: "-100",
		UnderlineThickness: "50",
		Version: "002.000",
		Notice: "Copyright (c) 1985, 1987, 1989, 1990, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.Times is a trademark of Linotype-Hell AG and/or its subsidiaries.",
		EncodingScheme: "AdobeStandardEncoding",
		CapHeight: "676",
		XHeight: "461",
		Ascender: "683",
		Descender: "-217",
		StdHW: "44",
		StdVW: "139"
	},
	{
		Comment: [
			"Copyright (c) 1985, 1987, 1989, 1990, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
			"Creation Date: Thu May  1 13:04:06 1997",
			"UniqueID 43066",
			"VMusage 45874 56899"
		],
		FontName: "Times-BoldItalic",
		FullName: "Times Bold Italic",
		FamilyName: "Times",
		Weight: "Bold",
		ItalicAngle: "-15",
		IsFixedPitch: "false",
		CharacterSet: "ExtendedRoman",
		FontBBox: "-200 -218 996 921",
		UnderlinePosition: "-100",
		UnderlineThickness: "50",
		Version: "002.000",
		Notice: "Copyright (c) 1985, 1987, 1989, 1990, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.Times is a trademark of Linotype-Hell AG and/or its subsidiaries.",
		EncodingScheme: "AdobeStandardEncoding",
		CapHeight: "669",
		XHeight: "462",
		Ascender: "683",
		Descender: "-217",
		StdHW: "42",
		StdVW: "121"
	},
	{
		Comment: [
			"Copyright (c) 1985, 1987, 1989, 1990, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
			"Creation Date: Thu May  1 12:56:55 1997",
			"UniqueID 43067",
			"VMusage 47727 58752"
		],
		FontName: "Times-Italic",
		FullName: "Times Italic",
		FamilyName: "Times",
		Weight: "Medium",
		ItalicAngle: "-15.5",
		IsFixedPitch: "false",
		CharacterSet: "ExtendedRoman",
		FontBBox: "-169 -217 1010 883 ",
		UnderlinePosition: "-100",
		UnderlineThickness: "50",
		Version: "002.000",
		Notice: "Copyright (c) 1985, 1987, 1989, 1990, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.Times is a trademark of Linotype-Hell AG and/or its subsidiaries.",
		EncodingScheme: "AdobeStandardEncoding",
		CapHeight: "653",
		XHeight: "441",
		Ascender: "683",
		Descender: "-217",
		StdHW: "32",
		StdVW: "76"
	},
	{
		Comment: [
			"Copyright (c) 1985, 1987, 1989, 1990, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
			"Creation Date: Thu May  1 12:49:17 1997",
			"UniqueID 43068",
			"VMusage 43909 54934"
		],
		FontName: "Times-Roman",
		FullName: "Times Roman",
		FamilyName: "Times",
		Weight: "Roman",
		ItalicAngle: "0",
		IsFixedPitch: "false",
		CharacterSet: "ExtendedRoman",
		FontBBox: "-168 -218 1000 898 ",
		UnderlinePosition: "-100",
		UnderlineThickness: "50",
		Version: "002.000",
		Notice: "Copyright (c) 1985, 1987, 1989, 1990, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.Times is a trademark of Linotype-Hell AG and/or its subsidiaries.",
		EncodingScheme: "AdobeStandardEncoding",
		CapHeight: "662",
		XHeight: "450",
		Ascender: "683",
		Descender: "-217",
		StdHW: "28",
		StdVW: "84"
	},
	{
		Comment: [
			"Copyright (c) 1989, 1990, 1991, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
			"Creation Date: Mon Jun 23 16:28:00 1997",
			"UniqueID 43048",
			"VMusage 41139 52164"
		],
		FontName: "Courier-Bold",
		FullName: "Courier Bold",
		FamilyName: "Courier",
		Weight: "Bold",
		ItalicAngle: "0",
		IsFixedPitch: "true",
		CharacterSet: "ExtendedRoman",
		FontBBox: "-113 -250 749 801 ",
		UnderlinePosition: "-100",
		UnderlineThickness: "50",
		Version: "003.000",
		Notice: "Copyright (c) 1989, 1990, 1991, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
		EncodingScheme: "AdobeStandardEncoding",
		CapHeight: "562",
		XHeight: "439",
		Ascender: "629",
		Descender: "-157",
		StdHW: "84",
		StdVW: "106"
	},
	{
		Comment: [
			"Copyright (c) 1989, 1990, 1991, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
			"Creation Date: Mon Jun 23 16:28:46 1997",
			"UniqueID 43049",
			"VMusage 17529 79244"
		],
		FontName: "Courier-BoldOblique",
		FullName: "Courier Bold Oblique",
		FamilyName: "Courier",
		Weight: "Bold",
		ItalicAngle: "-12",
		IsFixedPitch: "true",
		CharacterSet: "ExtendedRoman",
		FontBBox: "-57 -250 869 801",
		UnderlinePosition: "-100",
		UnderlineThickness: "50",
		Version: "003.000",
		Notice: "Copyright (c) 1989, 1990, 1991, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
		EncodingScheme: "AdobeStandardEncoding",
		CapHeight: "562",
		XHeight: "439",
		Ascender: "629",
		Descender: "-157",
		StdHW: "84",
		StdVW: "106"
	},
	{
		Comment: [
			"Copyright (c) 1989, 1990, 1991, 1992, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
			"Creation Date: Thu May  1 17:37:52 1997",
			"UniqueID 43051",
			"VMusage 16248 75829"
		],
		FontName: "Courier-Oblique",
		FullName: "Courier Oblique",
		FamilyName: "Courier",
		Weight: "Medium",
		ItalicAngle: "-12",
		IsFixedPitch: "true",
		CharacterSet: "ExtendedRoman",
		FontBBox: "-27 -250 849 805 ",
		UnderlinePosition: "-100",
		UnderlineThickness: "50",
		Version: "003.000",
		Notice: "Copyright (c) 1989, 1990, 1991, 1992, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
		EncodingScheme: "AdobeStandardEncoding",
		CapHeight: "562",
		XHeight: "426",
		Ascender: "629",
		Descender: "-157",
		StdHW: "51",
		StdVW: "51"
	},
	{
		Comment: [
			"Copyright (c) 1989, 1990, 1991, 1992, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
			"Creation Date: Thu May  1 17:27:09 1997",
			"UniqueID 43050",
			"VMusage 39754 50779"
		],
		FontName: "Courier",
		FullName: "Courier",
		FamilyName: "Courier",
		Weight: "Medium",
		ItalicAngle: "0",
		IsFixedPitch: "true",
		CharacterSet: "ExtendedRoman",
		FontBBox: "-23 -250 715 805 ",
		UnderlinePosition: "-100",
		UnderlineThickness: "50",
		Version: "003.000",
		Notice: "Copyright (c) 1989, 1990, 1991, 1992, 1993, 1997 Adobe Systems Incorporated.  All Rights Reserved.",
		EncodingScheme: "AdobeStandardEncoding",
		CapHeight: "562",
		XHeight: "426",
		Ascender: "629",
		Descender: "-157",
		StdHW: "51",
		StdVW: "51"
	}
];
var glyphWidths = {
	space: [
		278,
		278,
		278,
		278,
		250,
		250,
		250,
		250,
		600,
		600,
		600,
		600
	],
	exclam: [
		333,
		333,
		278,
		278,
		333,
		389,
		333,
		333,
		600,
		600,
		600,
		600
	],
	quotedbl: [
		474,
		474,
		355,
		355,
		555,
		555,
		420,
		408,
		600,
		600,
		600,
		600
	],
	numbersign: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	dollar: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	percent: [
		889,
		889,
		889,
		889,
		1000,
		833,
		833,
		833,
		600,
		600,
		600,
		600
	],
	ampersand: [
		722,
		722,
		667,
		667,
		833,
		778,
		778,
		778,
		600,
		600,
		600,
		600
	],
	quoteright: [
		278,
		278,
		222,
		222,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	parenleft: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	parenright: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	asterisk: [
		389,
		389,
		389,
		389,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	plus: [
		584,
		584,
		584,
		584,
		570,
		570,
		675,
		564,
		600,
		600,
		600,
		600
	],
	comma: [
		278,
		278,
		278,
		278,
		250,
		250,
		250,
		250,
		600,
		600,
		600,
		600
	],
	hyphen: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	period: [
		278,
		278,
		278,
		278,
		250,
		250,
		250,
		250,
		600,
		600,
		600,
		600
	],
	slash: [
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	zero: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	one: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	two: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	three: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	four: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	five: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	six: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	seven: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	eight: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	nine: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	colon: [
		333,
		333,
		278,
		278,
		333,
		333,
		333,
		278,
		600,
		600,
		600,
		600
	],
	semicolon: [
		333,
		333,
		278,
		278,
		333,
		333,
		333,
		278,
		600,
		600,
		600,
		600
	],
	less: [
		584,
		584,
		584,
		584,
		570,
		570,
		675,
		564,
		600,
		600,
		600,
		600
	],
	equal: [
		584,
		584,
		584,
		584,
		570,
		570,
		675,
		564,
		600,
		600,
		600,
		600
	],
	greater: [
		584,
		584,
		584,
		584,
		570,
		570,
		675,
		564,
		600,
		600,
		600,
		600
	],
	question: [
		611,
		611,
		556,
		556,
		500,
		500,
		500,
		444,
		600,
		600,
		600,
		600
	],
	at: [
		975,
		975,
		1015,
		1015,
		930,
		832,
		920,
		921,
		600,
		600,
		600,
		600
	],
	A: [
		722,
		722,
		667,
		667,
		722,
		667,
		611,
		722,
		600,
		600,
		600,
		600
	],
	B: [
		722,
		722,
		667,
		667,
		667,
		667,
		611,
		667,
		600,
		600,
		600,
		600
	],
	C: [
		722,
		722,
		722,
		722,
		722,
		667,
		667,
		667,
		600,
		600,
		600,
		600
	],
	D: [
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	E: [
		667,
		667,
		667,
		667,
		667,
		667,
		611,
		611,
		600,
		600,
		600,
		600
	],
	F: [
		611,
		611,
		611,
		611,
		611,
		667,
		611,
		556,
		600,
		600,
		600,
		600
	],
	G: [
		778,
		778,
		778,
		778,
		778,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	H: [
		722,
		722,
		722,
		722,
		778,
		778,
		722,
		722,
		600,
		600,
		600,
		600
	],
	I: [
		278,
		278,
		278,
		278,
		389,
		389,
		333,
		333,
		600,
		600,
		600,
		600
	],
	J: [
		556,
		556,
		500,
		500,
		500,
		500,
		444,
		389,
		600,
		600,
		600,
		600
	],
	K: [
		722,
		722,
		667,
		667,
		778,
		667,
		667,
		722,
		600,
		600,
		600,
		600
	],
	L: [
		611,
		611,
		556,
		556,
		667,
		611,
		556,
		611,
		600,
		600,
		600,
		600
	],
	M: [
		833,
		833,
		833,
		833,
		944,
		889,
		833,
		889,
		600,
		600,
		600,
		600
	],
	N: [
		722,
		722,
		722,
		722,
		722,
		722,
		667,
		722,
		600,
		600,
		600,
		600
	],
	O: [
		778,
		778,
		778,
		778,
		778,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	P: [
		667,
		667,
		667,
		667,
		611,
		611,
		611,
		556,
		600,
		600,
		600,
		600
	],
	Q: [
		778,
		778,
		778,
		778,
		778,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	R: [
		722,
		722,
		722,
		722,
		722,
		667,
		611,
		667,
		600,
		600,
		600,
		600
	],
	S: [
		667,
		667,
		667,
		667,
		556,
		556,
		500,
		556,
		600,
		600,
		600,
		600
	],
	T: [
		611,
		611,
		611,
		611,
		667,
		611,
		556,
		611,
		600,
		600,
		600,
		600
	],
	U: [
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	V: [
		667,
		667,
		667,
		667,
		722,
		667,
		611,
		722,
		600,
		600,
		600,
		600
	],
	W: [
		944,
		944,
		944,
		944,
		1000,
		889,
		833,
		944,
		600,
		600,
		600,
		600
	],
	X: [
		667,
		667,
		667,
		667,
		722,
		667,
		611,
		722,
		600,
		600,
		600,
		600
	],
	Y: [
		667,
		667,
		667,
		667,
		722,
		611,
		556,
		722,
		600,
		600,
		600,
		600
	],
	Z: [
		611,
		611,
		611,
		611,
		667,
		611,
		556,
		611,
		600,
		600,
		600,
		600
	],
	bracketleft: [
		333,
		333,
		278,
		278,
		333,
		333,
		389,
		333,
		600,
		600,
		600,
		600
	],
	backslash: [
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	bracketright: [
		333,
		333,
		278,
		278,
		333,
		333,
		389,
		333,
		600,
		600,
		600,
		600
	],
	asciicircum: [
		584,
		584,
		469,
		469,
		581,
		570,
		422,
		469,
		600,
		600,
		600,
		600
	],
	underscore: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	quoteleft: [
		278,
		278,
		222,
		222,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	a: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		444,
		600,
		600,
		600,
		600
	],
	b: [
		611,
		611,
		556,
		556,
		556,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	c: [
		556,
		556,
		500,
		500,
		444,
		444,
		444,
		444,
		600,
		600,
		600,
		600
	],
	d: [
		611,
		611,
		556,
		556,
		556,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	e: [
		556,
		556,
		556,
		556,
		444,
		444,
		444,
		444,
		600,
		600,
		600,
		600
	],
	f: [
		333,
		333,
		278,
		278,
		333,
		333,
		278,
		333,
		600,
		600,
		600,
		600
	],
	g: [
		611,
		611,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	h: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	i: [
		278,
		278,
		222,
		222,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	j: [
		278,
		278,
		222,
		222,
		333,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	k: [
		556,
		556,
		500,
		500,
		556,
		500,
		444,
		500,
		600,
		600,
		600,
		600
	],
	l: [
		278,
		278,
		222,
		222,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	m: [
		889,
		889,
		833,
		833,
		833,
		778,
		722,
		778,
		600,
		600,
		600,
		600
	],
	n: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	o: [
		611,
		611,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	p: [
		611,
		611,
		556,
		556,
		556,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	q: [
		611,
		611,
		556,
		556,
		556,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	r: [
		389,
		389,
		333,
		333,
		444,
		389,
		389,
		333,
		600,
		600,
		600,
		600
	],
	s: [
		556,
		556,
		500,
		500,
		389,
		389,
		389,
		389,
		600,
		600,
		600,
		600
	],
	t: [
		333,
		333,
		278,
		278,
		333,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	u: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	v: [
		556,
		556,
		500,
		500,
		500,
		444,
		444,
		500,
		600,
		600,
		600,
		600
	],
	w: [
		778,
		778,
		722,
		722,
		722,
		667,
		667,
		722,
		600,
		600,
		600,
		600
	],
	x: [
		556,
		556,
		500,
		500,
		500,
		500,
		444,
		500,
		600,
		600,
		600,
		600
	],
	y: [
		556,
		556,
		500,
		500,
		500,
		444,
		444,
		500,
		600,
		600,
		600,
		600
	],
	z: [
		500,
		500,
		500,
		500,
		444,
		389,
		389,
		444,
		600,
		600,
		600,
		600
	],
	braceleft: [
		389,
		389,
		334,
		334,
		394,
		348,
		400,
		480,
		600,
		600,
		600,
		600
	],
	bar: [
		280,
		280,
		260,
		260,
		220,
		220,
		275,
		200,
		600,
		600,
		600,
		600
	],
	braceright: [
		389,
		389,
		334,
		334,
		394,
		348,
		400,
		480,
		600,
		600,
		600,
		600
	],
	asciitilde: [
		584,
		584,
		584,
		584,
		520,
		570,
		541,
		541,
		600,
		600,
		600,
		600
	],
	exclamdown: [
		333,
		333,
		333,
		333,
		333,
		389,
		389,
		333,
		600,
		600,
		600,
		600
	],
	cent: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	sterling: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	fraction: [
		167,
		167,
		167,
		167,
		167,
		167,
		167,
		167,
		600,
		600,
		600,
		600
	],
	yen: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	florin: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	section: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	currency: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	quotesingle: [
		238,
		238,
		191,
		191,
		278,
		278,
		214,
		180,
		600,
		600,
		600,
		600
	],
	quotedblleft: [
		500,
		500,
		333,
		333,
		500,
		500,
		556,
		444,
		600,
		600,
		600,
		600
	],
	guillemotleft: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	guilsinglleft: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	guilsinglright: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	fi: [
		611,
		611,
		500,
		500,
		556,
		556,
		500,
		556,
		600,
		600,
		600,
		600
	],
	fl: [
		611,
		611,
		500,
		500,
		556,
		556,
		500,
		556,
		600,
		600,
		600,
		600
	],
	endash: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	dagger: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	daggerdbl: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	periodcentered: [
		278,
		278,
		278,
		278,
		250,
		250,
		250,
		250,
		600,
		600,
		600,
		600
	],
	paragraph: [
		556,
		556,
		537,
		537,
		540,
		500,
		523,
		453,
		600,
		600,
		600,
		600
	],
	bullet: [
		350,
		350,
		350,
		350,
		350,
		350,
		350,
		350,
		600,
		600,
		600,
		600
	],
	quotesinglbase: [
		278,
		278,
		222,
		222,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	quotedblbase: [
		500,
		500,
		333,
		333,
		500,
		500,
		556,
		444,
		600,
		600,
		600,
		600
	],
	quotedblright: [
		500,
		500,
		333,
		333,
		500,
		500,
		556,
		444,
		600,
		600,
		600,
		600
	],
	guillemotright: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	ellipsis: [
		1000,
		1000,
		1000,
		1000,
		1000,
		1000,
		889,
		1000,
		600,
		600,
		600,
		600
	],
	perthousand: [
		1000,
		1000,
		1000,
		1000,
		1000,
		1000,
		1000,
		1000,
		600,
		600,
		600,
		600
	],
	questiondown: [
		611,
		611,
		611,
		611,
		500,
		500,
		500,
		444,
		600,
		600,
		600,
		600
	],
	grave: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	acute: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	circumflex: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	tilde: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	macron: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	breve: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	dotaccent: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	dieresis: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	ring: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	cedilla: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	hungarumlaut: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	ogonek: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	caron: [
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		333,
		600,
		600,
		600,
		600
	],
	emdash: [
		1000,
		1000,
		1000,
		1000,
		1000,
		1000,
		889,
		1000,
		600,
		600,
		600,
		600
	],
	AE: [
		1000,
		1000,
		1000,
		1000,
		1000,
		944,
		889,
		889,
		600,
		600,
		600,
		600
	],
	ordfeminine: [
		370,
		370,
		370,
		370,
		300,
		266,
		276,
		276,
		600,
		600,
		600,
		600
	],
	Lslash: [
		611,
		611,
		556,
		556,
		667,
		611,
		556,
		611,
		600,
		600,
		600,
		600
	],
	Oslash: [
		778,
		778,
		778,
		778,
		778,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	OE: [
		1000,
		1000,
		1000,
		1000,
		1000,
		944,
		944,
		889,
		600,
		600,
		600,
		600
	],
	ordmasculine: [
		365,
		365,
		365,
		365,
		330,
		300,
		310,
		310,
		600,
		600,
		600,
		600
	],
	ae: [
		889,
		889,
		889,
		889,
		722,
		722,
		667,
		667,
		600,
		600,
		600,
		600
	],
	dotlessi: [
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	lslash: [
		278,
		278,
		222,
		222,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	oslash: [
		611,
		611,
		611,
		611,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	oe: [
		944,
		944,
		944,
		944,
		722,
		722,
		667,
		722,
		600,
		600,
		600,
		600
	],
	germandbls: [
		611,
		611,
		611,
		611,
		556,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	Idieresis: [
		278,
		278,
		278,
		278,
		389,
		389,
		333,
		333,
		600,
		600,
		600,
		600
	],
	eacute: [
		556,
		556,
		556,
		556,
		444,
		444,
		444,
		444,
		600,
		600,
		600,
		600
	],
	abreve: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		444,
		600,
		600,
		600,
		600
	],
	uhungarumlaut: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	ecaron: [
		556,
		556,
		556,
		556,
		444,
		444,
		444,
		444,
		600,
		600,
		600,
		600
	],
	Ydieresis: [
		667,
		667,
		667,
		667,
		722,
		611,
		556,
		722,
		600,
		600,
		600,
		600
	],
	divide: [
		584,
		584,
		584,
		584,
		570,
		570,
		675,
		564,
		600,
		600,
		600,
		600
	],
	Yacute: [
		667,
		667,
		667,
		667,
		722,
		611,
		556,
		722,
		600,
		600,
		600,
		600
	],
	Acircumflex: [
		722,
		722,
		667,
		667,
		722,
		667,
		611,
		722,
		600,
		600,
		600,
		600
	],
	aacute: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		444,
		600,
		600,
		600,
		600
	],
	Ucircumflex: [
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	yacute: [
		556,
		556,
		500,
		500,
		500,
		444,
		444,
		500,
		600,
		600,
		600,
		600
	],
	scommaaccent: [
		556,
		556,
		500,
		500,
		389,
		389,
		389,
		389,
		600,
		600,
		600,
		600
	],
	ecircumflex: [
		556,
		556,
		556,
		556,
		444,
		444,
		444,
		444,
		600,
		600,
		600,
		600
	],
	Uring: [
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	Udieresis: [
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	aogonek: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		444,
		600,
		600,
		600,
		600
	],
	Uacute: [
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	uogonek: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	Edieresis: [
		667,
		667,
		667,
		667,
		667,
		667,
		611,
		611,
		600,
		600,
		600,
		600
	],
	Dcroat: [
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	commaaccent: [
		250,
		250,
		250,
		250,
		250,
		250,
		250,
		250,
		600,
		600,
		600,
		600
	],
	copyright: [
		737,
		737,
		737,
		737,
		747,
		747,
		760,
		760,
		600,
		600,
		600,
		600
	],
	Emacron: [
		667,
		667,
		667,
		667,
		667,
		667,
		611,
		611,
		600,
		600,
		600,
		600
	],
	ccaron: [
		556,
		556,
		500,
		500,
		444,
		444,
		444,
		444,
		600,
		600,
		600,
		600
	],
	aring: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		444,
		600,
		600,
		600,
		600
	],
	Ncommaaccent: [
		722,
		722,
		722,
		722,
		722,
		722,
		667,
		722,
		600,
		600,
		600,
		600
	],
	lacute: [
		278,
		278,
		222,
		222,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	agrave: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		444,
		600,
		600,
		600,
		600
	],
	Tcommaaccent: [
		611,
		611,
		611,
		611,
		667,
		611,
		556,
		611,
		600,
		600,
		600,
		600
	],
	Cacute: [
		722,
		722,
		722,
		722,
		722,
		667,
		667,
		667,
		600,
		600,
		600,
		600
	],
	atilde: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		444,
		600,
		600,
		600,
		600
	],
	Edotaccent: [
		667,
		667,
		667,
		667,
		667,
		667,
		611,
		611,
		600,
		600,
		600,
		600
	],
	scaron: [
		556,
		556,
		500,
		500,
		389,
		389,
		389,
		389,
		600,
		600,
		600,
		600
	],
	scedilla: [
		556,
		556,
		500,
		500,
		389,
		389,
		389,
		389,
		600,
		600,
		600,
		600
	],
	iacute: [
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	lozenge: [
		494,
		494,
		471,
		471,
		494,
		494,
		471,
		471,
		600,
		600,
		600,
		600
	],
	Rcaron: [
		722,
		722,
		722,
		722,
		722,
		667,
		611,
		667,
		600,
		600,
		600,
		600
	],
	Gcommaaccent: [
		778,
		778,
		778,
		778,
		778,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	ucircumflex: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	acircumflex: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		444,
		600,
		600,
		600,
		600
	],
	Amacron: [
		722,
		722,
		667,
		667,
		722,
		667,
		611,
		722,
		600,
		600,
		600,
		600
	],
	rcaron: [
		389,
		389,
		333,
		333,
		444,
		389,
		389,
		333,
		600,
		600,
		600,
		600
	],
	ccedilla: [
		556,
		556,
		500,
		500,
		444,
		444,
		444,
		444,
		600,
		600,
		600,
		600
	],
	Zdotaccent: [
		611,
		611,
		611,
		611,
		667,
		611,
		556,
		611,
		600,
		600,
		600,
		600
	],
	Thorn: [
		667,
		667,
		667,
		667,
		611,
		611,
		611,
		556,
		600,
		600,
		600,
		600
	],
	Omacron: [
		778,
		778,
		778,
		778,
		778,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	Racute: [
		722,
		722,
		722,
		722,
		722,
		667,
		611,
		667,
		600,
		600,
		600,
		600
	],
	Sacute: [
		667,
		667,
		667,
		667,
		556,
		556,
		500,
		556,
		600,
		600,
		600,
		600
	],
	dcaron: [
		743,
		743,
		643,
		643,
		672,
		608,
		544,
		588,
		600,
		600,
		600,
		600
	],
	Umacron: [
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	uring: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	threesuperior: [
		333,
		333,
		333,
		333,
		300,
		300,
		300,
		300,
		600,
		600,
		600,
		600
	],
	Ograve: [
		778,
		778,
		778,
		778,
		778,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	Agrave: [
		722,
		722,
		667,
		667,
		722,
		667,
		611,
		722,
		600,
		600,
		600,
		600
	],
	Abreve: [
		722,
		722,
		667,
		667,
		722,
		667,
		611,
		722,
		600,
		600,
		600,
		600
	],
	multiply: [
		584,
		584,
		584,
		584,
		570,
		570,
		675,
		564,
		600,
		600,
		600,
		600
	],
	uacute: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	Tcaron: [
		611,
		611,
		611,
		611,
		667,
		611,
		556,
		611,
		600,
		600,
		600,
		600
	],
	partialdiff: [
		494,
		494,
		476,
		476,
		494,
		494,
		476,
		476,
		600,
		600,
		600,
		600
	],
	ydieresis: [
		556,
		556,
		500,
		500,
		500,
		444,
		444,
		500,
		600,
		600,
		600,
		600
	],
	Nacute: [
		722,
		722,
		722,
		722,
		722,
		722,
		667,
		722,
		600,
		600,
		600,
		600
	],
	icircumflex: [
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	Ecircumflex: [
		667,
		667,
		667,
		667,
		667,
		667,
		611,
		611,
		600,
		600,
		600,
		600
	],
	adieresis: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		444,
		600,
		600,
		600,
		600
	],
	edieresis: [
		556,
		556,
		556,
		556,
		444,
		444,
		444,
		444,
		600,
		600,
		600,
		600
	],
	cacute: [
		556,
		556,
		500,
		500,
		444,
		444,
		444,
		444,
		600,
		600,
		600,
		600
	],
	nacute: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	umacron: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	Ncaron: [
		722,
		722,
		722,
		722,
		722,
		722,
		667,
		722,
		600,
		600,
		600,
		600
	],
	Iacute: [
		278,
		278,
		278,
		278,
		389,
		389,
		333,
		333,
		600,
		600,
		600,
		600
	],
	plusminus: [
		584,
		584,
		584,
		584,
		570,
		570,
		675,
		564,
		600,
		600,
		600,
		600
	],
	brokenbar: [
		280,
		280,
		260,
		260,
		220,
		220,
		275,
		200,
		600,
		600,
		600,
		600
	],
	registered: [
		737,
		737,
		737,
		737,
		747,
		747,
		760,
		760,
		600,
		600,
		600,
		600
	],
	Gbreve: [
		778,
		778,
		778,
		778,
		778,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	Idotaccent: [
		278,
		278,
		278,
		278,
		389,
		389,
		333,
		333,
		600,
		600,
		600,
		600
	],
	summation: [
		600,
		600,
		600,
		600,
		600,
		600,
		600,
		600,
		600,
		600,
		600,
		600
	],
	Egrave: [
		667,
		667,
		667,
		667,
		667,
		667,
		611,
		611,
		600,
		600,
		600,
		600
	],
	racute: [
		389,
		389,
		333,
		333,
		444,
		389,
		389,
		333,
		600,
		600,
		600,
		600
	],
	omacron: [
		611,
		611,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	Zacute: [
		611,
		611,
		611,
		611,
		667,
		611,
		556,
		611,
		600,
		600,
		600,
		600
	],
	Zcaron: [
		611,
		611,
		611,
		611,
		667,
		611,
		556,
		611,
		600,
		600,
		600,
		600
	],
	greaterequal: [
		549,
		549,
		549,
		549,
		549,
		549,
		549,
		549,
		600,
		600,
		600,
		600
	],
	Eth: [
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	Ccedilla: [
		722,
		722,
		722,
		722,
		722,
		667,
		667,
		667,
		600,
		600,
		600,
		600
	],
	lcommaaccent: [
		278,
		278,
		222,
		222,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	tcaron: [
		389,
		389,
		317,
		317,
		416,
		366,
		300,
		326,
		600,
		600,
		600,
		600
	],
	eogonek: [
		556,
		556,
		556,
		556,
		444,
		444,
		444,
		444,
		600,
		600,
		600,
		600
	],
	Uogonek: [
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	Aacute: [
		722,
		722,
		667,
		667,
		722,
		667,
		611,
		722,
		600,
		600,
		600,
		600
	],
	Adieresis: [
		722,
		722,
		667,
		667,
		722,
		667,
		611,
		722,
		600,
		600,
		600,
		600
	],
	egrave: [
		556,
		556,
		556,
		556,
		444,
		444,
		444,
		444,
		600,
		600,
		600,
		600
	],
	zacute: [
		500,
		500,
		500,
		500,
		444,
		389,
		389,
		444,
		600,
		600,
		600,
		600
	],
	iogonek: [
		278,
		278,
		222,
		222,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	Oacute: [
		778,
		778,
		778,
		778,
		778,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	oacute: [
		611,
		611,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	amacron: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		444,
		600,
		600,
		600,
		600
	],
	sacute: [
		556,
		556,
		500,
		500,
		389,
		389,
		389,
		389,
		600,
		600,
		600,
		600
	],
	idieresis: [
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	Ocircumflex: [
		778,
		778,
		778,
		778,
		778,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	Ugrave: [
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	Delta: [
		612,
		612,
		612,
		612,
		612,
		612,
		612,
		612,
		600,
		600,
		600,
		600
	],
	thorn: [
		611,
		611,
		556,
		556,
		556,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	twosuperior: [
		333,
		333,
		333,
		333,
		300,
		300,
		300,
		300,
		600,
		600,
		600,
		600
	],
	Odieresis: [
		778,
		778,
		778,
		778,
		778,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	mu: [
		611,
		611,
		556,
		556,
		556,
		576,
		500,
		500,
		600,
		600,
		600,
		600
	],
	igrave: [
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	ohungarumlaut: [
		611,
		611,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	Eogonek: [
		667,
		667,
		667,
		667,
		667,
		667,
		611,
		611,
		600,
		600,
		600,
		600
	],
	dcroat: [
		611,
		611,
		556,
		556,
		556,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	threequarters: [
		834,
		834,
		834,
		834,
		750,
		750,
		750,
		750,
		600,
		600,
		600,
		600
	],
	Scedilla: [
		667,
		667,
		667,
		667,
		556,
		556,
		500,
		556,
		600,
		600,
		600,
		600
	],
	lcaron: [
		400,
		400,
		299,
		299,
		394,
		382,
		300,
		344,
		600,
		600,
		600,
		600
	],
	Kcommaaccent: [
		722,
		722,
		667,
		667,
		778,
		667,
		667,
		722,
		600,
		600,
		600,
		600
	],
	Lacute: [
		611,
		611,
		556,
		556,
		667,
		611,
		556,
		611,
		600,
		600,
		600,
		600
	],
	trademark: [
		1000,
		1000,
		1000,
		1000,
		1000,
		1000,
		980,
		980,
		600,
		600,
		600,
		600
	],
	edotaccent: [
		556,
		556,
		556,
		556,
		444,
		444,
		444,
		444,
		600,
		600,
		600,
		600
	],
	Igrave: [
		278,
		278,
		278,
		278,
		389,
		389,
		333,
		333,
		600,
		600,
		600,
		600
	],
	Imacron: [
		278,
		278,
		278,
		278,
		389,
		389,
		333,
		333,
		600,
		600,
		600,
		600
	],
	Lcaron: [
		611,
		611,
		556,
		556,
		667,
		611,
		611,
		611,
		600,
		600,
		600,
		600
	],
	onehalf: [
		834,
		834,
		834,
		834,
		750,
		750,
		750,
		750,
		600,
		600,
		600,
		600
	],
	lessequal: [
		549,
		549,
		549,
		549,
		549,
		549,
		549,
		549,
		600,
		600,
		600,
		600
	],
	ocircumflex: [
		611,
		611,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	ntilde: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	Uhungarumlaut: [
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	Eacute: [
		667,
		667,
		667,
		667,
		667,
		667,
		611,
		611,
		600,
		600,
		600,
		600
	],
	emacron: [
		556,
		556,
		556,
		556,
		444,
		444,
		444,
		444,
		600,
		600,
		600,
		600
	],
	gbreve: [
		611,
		611,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	onequarter: [
		834,
		834,
		834,
		834,
		750,
		750,
		750,
		750,
		600,
		600,
		600,
		600
	],
	Scaron: [
		667,
		667,
		667,
		667,
		556,
		556,
		500,
		556,
		600,
		600,
		600,
		600
	],
	Scommaaccent: [
		667,
		667,
		667,
		667,
		556,
		556,
		500,
		556,
		600,
		600,
		600,
		600
	],
	Ohungarumlaut: [
		778,
		778,
		778,
		778,
		778,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	degree: [
		400,
		400,
		400,
		400,
		400,
		400,
		400,
		400,
		600,
		600,
		600,
		600
	],
	ograve: [
		611,
		611,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	Ccaron: [
		722,
		722,
		722,
		722,
		722,
		667,
		667,
		667,
		600,
		600,
		600,
		600
	],
	ugrave: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	radical: [
		549,
		549,
		453,
		453,
		549,
		549,
		453,
		453,
		600,
		600,
		600,
		600
	],
	Dcaron: [
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	rcommaaccent: [
		389,
		389,
		333,
		333,
		444,
		389,
		389,
		333,
		600,
		600,
		600,
		600
	],
	Ntilde: [
		722,
		722,
		722,
		722,
		722,
		722,
		667,
		722,
		600,
		600,
		600,
		600
	],
	otilde: [
		611,
		611,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	Rcommaaccent: [
		722,
		722,
		722,
		722,
		722,
		667,
		611,
		667,
		600,
		600,
		600,
		600
	],
	Lcommaaccent: [
		611,
		611,
		556,
		556,
		667,
		611,
		556,
		611,
		600,
		600,
		600,
		600
	],
	Atilde: [
		722,
		722,
		667,
		667,
		722,
		667,
		611,
		722,
		600,
		600,
		600,
		600
	],
	Aogonek: [
		722,
		722,
		667,
		667,
		722,
		667,
		611,
		722,
		600,
		600,
		600,
		600
	],
	Aring: [
		722,
		722,
		667,
		667,
		722,
		667,
		611,
		722,
		600,
		600,
		600,
		600
	],
	Otilde: [
		778,
		778,
		778,
		778,
		778,
		722,
		722,
		722,
		600,
		600,
		600,
		600
	],
	zdotaccent: [
		500,
		500,
		500,
		500,
		444,
		389,
		389,
		444,
		600,
		600,
		600,
		600
	],
	Ecaron: [
		667,
		667,
		667,
		667,
		667,
		667,
		611,
		611,
		600,
		600,
		600,
		600
	],
	Iogonek: [
		278,
		278,
		278,
		278,
		389,
		389,
		333,
		333,
		600,
		600,
		600,
		600
	],
	kcommaaccent: [
		556,
		556,
		500,
		500,
		556,
		500,
		444,
		500,
		600,
		600,
		600,
		600
	],
	minus: [
		584,
		584,
		584,
		584,
		570,
		606,
		675,
		564,
		600,
		600,
		600,
		600
	],
	Icircumflex: [
		278,
		278,
		278,
		278,
		389,
		389,
		333,
		333,
		600,
		600,
		600,
		600
	],
	ncaron: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	tcommaaccent: [
		333,
		333,
		278,
		278,
		333,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	logicalnot: [
		584,
		584,
		584,
		584,
		570,
		606,
		675,
		564,
		600,
		600,
		600,
		600
	],
	odieresis: [
		611,
		611,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	udieresis: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	notequal: [
		549,
		549,
		549,
		549,
		549,
		549,
		549,
		549,
		600,
		600,
		600,
		600
	],
	gcommaaccent: [
		611,
		611,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	eth: [
		611,
		611,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	],
	zcaron: [
		500,
		500,
		500,
		500,
		444,
		389,
		389,
		444,
		600,
		600,
		600,
		600
	],
	ncommaaccent: [
		611,
		611,
		556,
		556,
		556,
		556,
		500,
		500,
		600,
		600,
		600,
		600
	],
	onesuperior: [
		333,
		333,
		333,
		333,
		300,
		300,
		300,
		300,
		600,
		600,
		600,
		600
	],
	imacron: [
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		278,
		600,
		600,
		600,
		600
	],
	Euro: [
		556,
		556,
		556,
		556,
		500,
		500,
		500,
		500,
		600,
		600,
		600,
		600
	]
};
var kernPairs = {
	AC: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	ACacute: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	ACcaron: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	ACcedilla: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AG: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AGbreve: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AGcommaaccent: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AO: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AOacute: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AOcircumflex: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AOdieresis: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AOgrave: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AOhungarumlaut: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AOmacron: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AOslash: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AOtilde: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AQ: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-55,
		-40,
		-55
	],
	AT: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	ATcaron: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	ATcommaaccent: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AU: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AUacute: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AUcircumflex: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AUdieresis: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AUgrave: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AUhungarumlaut: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AUmacron: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AUogonek: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AUring: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AV: [
		-80,
		-80,
		-70,
		-70,
		-145,
		-95,
		-105,
		-135
	],
	AW: [
		-60,
		-60,
		-50,
		-50,
		-130,
		-100,
		-95,
		-90
	],
	AY: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AYacute: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AYdieresis: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	Au: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Auacute: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aucircumflex: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Audieresis: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Augrave: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Auhungarumlaut: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aumacron: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Auogonek: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Auring: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Av: [
		-40,
		-40,
		-40,
		-40,
		-100,
		-74,
		-55,
		-74
	],
	Aw: [
		-30,
		-30,
		-40,
		-40,
		-90,
		-74,
		-55,
		-92
	],
	Ay: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Ayacute: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Aydieresis: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	AacuteC: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AacuteCacute: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AacuteCcaron: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AacuteCcedilla: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AacuteG: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AacuteGbreve: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AacuteGcommaaccent: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AacuteO: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AacuteOacute: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AacuteOcircumflex: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AacuteOdieresis: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AacuteOgrave: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AacuteOhungarumlaut: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AacuteOmacron: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AacuteOslash: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AacuteOtilde: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AacuteQ: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-55,
		-40,
		-55
	],
	AacuteT: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AacuteTcaron: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AacuteTcommaaccent: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AacuteU: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AacuteUacute: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AacuteUcircumflex: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AacuteUdieresis: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AacuteUgrave: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AacuteUhungarumlaut: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AacuteUmacron: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AacuteUogonek: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AacuteUring: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AacuteV: [
		-80,
		-80,
		-70,
		-70,
		-145,
		-95,
		-105,
		-135
	],
	AacuteW: [
		-60,
		-60,
		-50,
		-50,
		-130,
		-100,
		-95,
		-90
	],
	AacuteY: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AacuteYacute: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AacuteYdieresis: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	Aacuteu: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aacuteuacute: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aacuteucircumflex: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aacuteudieresis: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aacuteugrave: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aacuteuhungarumlaut: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aacuteumacron: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aacuteuogonek: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aacuteuring: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aacutev: [
		-40,
		-40,
		-40,
		-40,
		-100,
		-74,
		-55,
		-74
	],
	Aacutew: [
		-30,
		-30,
		-40,
		-40,
		-90,
		-74,
		-55,
		-92
	],
	Aacutey: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Aacuteyacute: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Aacuteydieresis: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	AbreveC: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AbreveCacute: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AbreveCcaron: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AbreveCcedilla: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AbreveG: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AbreveGbreve: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AbreveGcommaaccent: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AbreveO: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AbreveOacute: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AbreveOcircumflex: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AbreveOdieresis: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AbreveOgrave: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AbreveOhungarumlaut: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AbreveOmacron: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AbreveOslash: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AbreveOtilde: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AbreveQ: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-55,
		-40,
		-55
	],
	AbreveT: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AbreveTcaron: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AbreveTcommaaccent: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AbreveU: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AbreveUacute: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AbreveUcircumflex: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AbreveUdieresis: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AbreveUgrave: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AbreveUhungarumlaut: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AbreveUmacron: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AbreveUogonek: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AbreveUring: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AbreveV: [
		-80,
		-80,
		-70,
		-70,
		-145,
		-95,
		-105,
		-135
	],
	AbreveW: [
		-60,
		-60,
		-50,
		-50,
		-130,
		-100,
		-95,
		-90
	],
	AbreveY: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AbreveYacute: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AbreveYdieresis: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	Abreveu: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Abreveuacute: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Abreveucircumflex: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Abreveudieresis: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Abreveugrave: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Abreveuhungarumlaut: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Abreveumacron: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Abreveuogonek: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Abreveuring: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Abrevev: [
		-40,
		-40,
		-40,
		-40,
		-100,
		-74,
		-55,
		-74
	],
	Abrevew: [
		-30,
		-30,
		-40,
		-40,
		-90,
		-74,
		-55,
		-92
	],
	Abrevey: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Abreveyacute: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Abreveydieresis: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	AcircumflexC: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AcircumflexCacute: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AcircumflexCcaron: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AcircumflexCcedilla: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AcircumflexG: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AcircumflexGbreve: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AcircumflexGcommaaccent: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AcircumflexO: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AcircumflexOacute: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AcircumflexOcircumflex: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AcircumflexOdieresis: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AcircumflexOgrave: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AcircumflexOhungarumlaut: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AcircumflexOmacron: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AcircumflexOslash: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AcircumflexOtilde: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AcircumflexQ: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-55,
		-40,
		-55
	],
	AcircumflexT: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AcircumflexTcaron: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AcircumflexTcommaaccent: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AcircumflexU: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AcircumflexUacute: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AcircumflexUcircumflex: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AcircumflexUdieresis: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AcircumflexUgrave: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AcircumflexUhungarumlaut: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AcircumflexUmacron: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AcircumflexUogonek: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AcircumflexUring: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AcircumflexV: [
		-80,
		-80,
		-70,
		-70,
		-145,
		-95,
		-105,
		-135
	],
	AcircumflexW: [
		-60,
		-60,
		-50,
		-50,
		-130,
		-100,
		-95,
		-90
	],
	AcircumflexY: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AcircumflexYacute: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AcircumflexYdieresis: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	Acircumflexu: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Acircumflexuacute: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Acircumflexucircumflex: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Acircumflexudieresis: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Acircumflexugrave: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Acircumflexuhungarumlaut: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Acircumflexumacron: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Acircumflexuogonek: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Acircumflexuring: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Acircumflexv: [
		-40,
		-40,
		-40,
		-40,
		-100,
		-74,
		-55,
		-74
	],
	Acircumflexw: [
		-30,
		-30,
		-40,
		-40,
		-90,
		-74,
		-55,
		-92
	],
	Acircumflexy: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Acircumflexyacute: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Acircumflexydieresis: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	AdieresisC: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AdieresisCacute: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AdieresisCcaron: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AdieresisCcedilla: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AdieresisG: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AdieresisGbreve: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AdieresisGcommaaccent: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AdieresisO: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AdieresisOacute: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AdieresisOcircumflex: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AdieresisOdieresis: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AdieresisOgrave: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AdieresisOhungarumlaut: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AdieresisOmacron: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AdieresisOslash: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AdieresisOtilde: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AdieresisQ: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-55,
		-40,
		-55
	],
	AdieresisT: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AdieresisTcaron: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AdieresisTcommaaccent: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AdieresisU: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AdieresisUacute: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AdieresisUcircumflex: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AdieresisUdieresis: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AdieresisUgrave: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AdieresisUhungarumlaut: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AdieresisUmacron: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AdieresisUogonek: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AdieresisUring: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AdieresisV: [
		-80,
		-80,
		-70,
		-70,
		-145,
		-95,
		-105,
		-135
	],
	AdieresisW: [
		-60,
		-60,
		-50,
		-50,
		-130,
		-100,
		-95,
		-90
	],
	AdieresisY: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AdieresisYacute: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AdieresisYdieresis: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	Adieresisu: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Adieresisuacute: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Adieresisucircumflex: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Adieresisudieresis: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Adieresisugrave: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Adieresisuhungarumlaut: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Adieresisumacron: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Adieresisuogonek: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Adieresisuring: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Adieresisv: [
		-40,
		-40,
		-40,
		-40,
		-100,
		-74,
		-55,
		-74
	],
	Adieresisw: [
		-30,
		-30,
		-40,
		-40,
		-90,
		-74,
		-55,
		-92
	],
	Adieresisy: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Adieresisyacute: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Adieresisydieresis: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	AgraveC: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AgraveCacute: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AgraveCcaron: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AgraveCcedilla: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AgraveG: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AgraveGbreve: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AgraveGcommaaccent: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AgraveO: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AgraveOacute: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AgraveOcircumflex: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AgraveOdieresis: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AgraveOgrave: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AgraveOhungarumlaut: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AgraveOmacron: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AgraveOslash: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AgraveOtilde: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AgraveQ: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-55,
		-40,
		-55
	],
	AgraveT: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AgraveTcaron: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AgraveTcommaaccent: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AgraveU: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AgraveUacute: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AgraveUcircumflex: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AgraveUdieresis: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AgraveUgrave: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AgraveUhungarumlaut: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AgraveUmacron: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AgraveUogonek: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AgraveUring: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AgraveV: [
		-80,
		-80,
		-70,
		-70,
		-145,
		-95,
		-105,
		-135
	],
	AgraveW: [
		-60,
		-60,
		-50,
		-50,
		-130,
		-100,
		-95,
		-90
	],
	AgraveY: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AgraveYacute: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AgraveYdieresis: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	Agraveu: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Agraveuacute: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Agraveucircumflex: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Agraveudieresis: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Agraveugrave: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Agraveuhungarumlaut: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Agraveumacron: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Agraveuogonek: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Agraveuring: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Agravev: [
		-40,
		-40,
		-40,
		-40,
		-100,
		-74,
		-55,
		-74
	],
	Agravew: [
		-30,
		-30,
		-40,
		-40,
		-90,
		-74,
		-55,
		-92
	],
	Agravey: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Agraveyacute: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Agraveydieresis: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	AmacronC: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AmacronCacute: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AmacronCcaron: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AmacronCcedilla: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AmacronG: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AmacronGbreve: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AmacronGcommaaccent: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AmacronO: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AmacronOacute: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AmacronOcircumflex: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AmacronOdieresis: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AmacronOgrave: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AmacronOhungarumlaut: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AmacronOmacron: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AmacronOslash: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AmacronOtilde: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AmacronQ: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-55,
		-40,
		-55
	],
	AmacronT: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AmacronTcaron: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AmacronTcommaaccent: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AmacronU: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AmacronUacute: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AmacronUcircumflex: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AmacronUdieresis: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AmacronUgrave: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AmacronUhungarumlaut: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AmacronUmacron: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AmacronUogonek: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AmacronUring: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AmacronV: [
		-80,
		-80,
		-70,
		-70,
		-145,
		-95,
		-105,
		-135
	],
	AmacronW: [
		-60,
		-60,
		-50,
		-50,
		-130,
		-100,
		-95,
		-90
	],
	AmacronY: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AmacronYacute: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AmacronYdieresis: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	Amacronu: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Amacronuacute: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Amacronucircumflex: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Amacronudieresis: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Amacronugrave: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Amacronuhungarumlaut: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Amacronumacron: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Amacronuogonek: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Amacronuring: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Amacronv: [
		-40,
		-40,
		-40,
		-40,
		-100,
		-74,
		-55,
		-74
	],
	Amacronw: [
		-30,
		-30,
		-40,
		-40,
		-90,
		-74,
		-55,
		-92
	],
	Amacrony: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Amacronyacute: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Amacronydieresis: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	AogonekC: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AogonekCacute: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AogonekCcaron: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AogonekCcedilla: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AogonekG: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AogonekGbreve: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AogonekGcommaaccent: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AogonekO: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AogonekOacute: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AogonekOcircumflex: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AogonekOdieresis: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AogonekOgrave: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AogonekOhungarumlaut: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AogonekOmacron: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AogonekOslash: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AogonekOtilde: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AogonekQ: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-55,
		-40,
		-55
	],
	AogonekT: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AogonekTcaron: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AogonekTcommaaccent: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AogonekU: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AogonekUacute: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AogonekUcircumflex: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AogonekUdieresis: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AogonekUgrave: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AogonekUhungarumlaut: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AogonekUmacron: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AogonekUogonek: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AogonekUring: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AogonekV: [
		-80,
		-80,
		-70,
		-70,
		-145,
		-95,
		-105,
		-135
	],
	AogonekW: [
		-60,
		-60,
		-50,
		-50,
		-130,
		-100,
		-95,
		-90
	],
	AogonekY: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AogonekYacute: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AogonekYdieresis: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	Aogoneku: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aogonekuacute: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aogonekucircumflex: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aogonekudieresis: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aogonekugrave: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aogonekuhungarumlaut: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aogonekumacron: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aogonekuogonek: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aogonekuring: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aogonekv: [
		-40,
		-40,
		-40,
		-40,
		-100,
		-74,
		-55,
		-74
	],
	Aogonekw: [
		-30,
		-30,
		-40,
		-40,
		-90,
		-74,
		-55,
		-52
	],
	Aogoneky: [
		-30,
		-30,
		-40,
		-40,
		-34,
		-34,
		-55,
		-52
	],
	Aogonekyacute: [
		-30,
		-30,
		-40,
		-40,
		-34,
		-34,
		-55,
		-52
	],
	Aogonekydieresis: [
		-30,
		-30,
		-40,
		-40,
		-34,
		-34,
		-55,
		-52
	],
	AringC: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AringCacute: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AringCcaron: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AringCcedilla: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AringG: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AringGbreve: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AringGcommaaccent: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AringO: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AringOacute: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AringOcircumflex: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AringOdieresis: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AringOgrave: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AringOhungarumlaut: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AringOmacron: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AringOslash: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AringOtilde: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AringQ: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-55,
		-40,
		-55
	],
	AringT: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AringTcaron: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AringTcommaaccent: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AringU: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AringUacute: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AringUcircumflex: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AringUdieresis: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AringUgrave: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AringUhungarumlaut: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AringUmacron: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AringUogonek: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AringUring: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AringV: [
		-80,
		-80,
		-70,
		-70,
		-145,
		-95,
		-105,
		-135
	],
	AringW: [
		-60,
		-60,
		-50,
		-50,
		-130,
		-100,
		-95,
		-90
	],
	AringY: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AringYacute: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AringYdieresis: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	Aringu: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aringuacute: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aringucircumflex: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aringudieresis: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aringugrave: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aringuhungarumlaut: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aringumacron: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aringuogonek: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aringuring: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Aringv: [
		-40,
		-40,
		-40,
		-40,
		-100,
		-74,
		-55,
		-74
	],
	Aringw: [
		-30,
		-30,
		-40,
		-40,
		-90,
		-74,
		-55,
		-92
	],
	Aringy: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Aringyacute: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Aringydieresis: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	AtildeC: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AtildeCacute: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AtildeCcaron: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AtildeCcedilla: [
		-40,
		-40,
		-30,
		-30,
		-55,
		-65,
		-30,
		-40
	],
	AtildeG: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AtildeGbreve: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AtildeGcommaaccent: [
		-50,
		-50,
		-30,
		-30,
		-55,
		-60,
		-35,
		-40
	],
	AtildeO: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AtildeOacute: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AtildeOcircumflex: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AtildeOdieresis: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AtildeOgrave: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AtildeOhungarumlaut: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AtildeOmacron: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AtildeOslash: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AtildeOtilde: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-50,
		-40,
		-55
	],
	AtildeQ: [
		-40,
		-40,
		-30,
		-30,
		-45,
		-55,
		-40,
		-55
	],
	AtildeT: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AtildeTcaron: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AtildeTcommaaccent: [
		-90,
		-90,
		-120,
		-120,
		-95,
		-55,
		-37,
		-111
	],
	AtildeU: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AtildeUacute: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AtildeUcircumflex: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AtildeUdieresis: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AtildeUgrave: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AtildeUhungarumlaut: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AtildeUmacron: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AtildeUogonek: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AtildeUring: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-55
	],
	AtildeV: [
		-80,
		-80,
		-70,
		-70,
		-145,
		-95,
		-105,
		-135
	],
	AtildeW: [
		-60,
		-60,
		-50,
		-50,
		-130,
		-100,
		-95,
		-90
	],
	AtildeY: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AtildeYacute: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	AtildeYdieresis: [
		-110,
		-110,
		-100,
		-100,
		-100,
		-70,
		-55,
		-105
	],
	Atildeu: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Atildeuacute: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Atildeucircumflex: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Atildeudieresis: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Atildeugrave: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Atildeuhungarumlaut: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Atildeumacron: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Atildeuogonek: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Atildeuring: [
		-30,
		-30,
		-30,
		-30,
		-50,
		-30,
		-20
	],
	Atildev: [
		-40,
		-40,
		-40,
		-40,
		-100,
		-74,
		-55,
		-74
	],
	Atildew: [
		-30,
		-30,
		-40,
		-40,
		-90,
		-74,
		-55,
		-92
	],
	Atildey: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Atildeyacute: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	Atildeydieresis: [
		-30,
		-30,
		-40,
		-40,
		-74,
		-74,
		-55,
		-92
	],
	BA: [
		-30,
		-30,
		0,
		0,
		-30,
		-25,
		-25,
		-35
	],
	BAacute: [
		-30,
		-30,
		0,
		0,
		-30,
		-25,
		-25,
		-35
	],
	BAbreve: [
		-30,
		-30,
		0,
		0,
		-30,
		-25,
		-25,
		-35
	],
	BAcircumflex: [
		-30,
		-30,
		0,
		0,
		-30,
		-25,
		-25,
		-35
	],
	BAdieresis: [
		-30,
		-30,
		0,
		0,
		-30,
		-25,
		-25,
		-35
	],
	BAgrave: [
		-30,
		-30,
		0,
		0,
		-30,
		-25,
		-25,
		-35
	],
	BAmacron: [
		-30,
		-30,
		0,
		0,
		-30,
		-25,
		-25,
		-35
	],
	BAogonek: [
		-30,
		-30,
		0,
		0,
		-30,
		-25,
		-25,
		-35
	],
	BAring: [
		-30,
		-30,
		0,
		0,
		-30,
		-25,
		-25,
		-35
	],
	BAtilde: [
		-30,
		-30,
		0,
		0,
		-30,
		-25,
		-25,
		-35
	],
	BU: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	BUacute: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	BUcircumflex: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	BUdieresis: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	BUgrave: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	BUhungarumlaut: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	BUmacron: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	BUogonek: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	BUring: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	DA: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DAacute: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DAbreve: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DAcircumflex: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DAdieresis: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DAgrave: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DAmacron: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DAogonek: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DAring: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DAtilde: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DV: [
		-40,
		-40,
		-70,
		-70,
		-40,
		-50,
		-40,
		-40
	],
	DW: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-30
	],
	DY: [
		-70,
		-70,
		-90,
		-90,
		-40,
		-50,
		-40,
		-55
	],
	DYacute: [
		-70,
		-70,
		-90,
		-90,
		-40,
		-50,
		-40,
		-55
	],
	DYdieresis: [
		-70,
		-70,
		-90,
		-90,
		-40,
		-50,
		-40,
		-55
	],
	Dcomma: [
		-30,
		-30,
		-70,
		-70
	],
	Dperiod: [
		-30,
		-30,
		-70,
		-70,
		-20
	],
	DcaronA: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcaronAacute: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcaronAbreve: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcaronAcircumflex: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcaronAdieresis: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcaronAgrave: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcaronAmacron: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcaronAogonek: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcaronAring: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcaronAtilde: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcaronV: [
		-40,
		-40,
		-70,
		-70,
		-40,
		-50,
		-40,
		-40
	],
	DcaronW: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-30
	],
	DcaronY: [
		-70,
		-70,
		-90,
		-90,
		-40,
		-50,
		-40,
		-55
	],
	DcaronYacute: [
		-70,
		-70,
		-90,
		-90,
		-40,
		-50,
		-40,
		-55
	],
	DcaronYdieresis: [
		-70,
		-70,
		-90,
		-90,
		-40,
		-50,
		-40,
		-55
	],
	Dcaroncomma: [
		-30,
		-30,
		-70,
		-70
	],
	Dcaronperiod: [
		-30,
		-30,
		-70,
		-70,
		-20
	],
	DcroatA: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcroatAacute: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcroatAbreve: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcroatAcircumflex: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcroatAdieresis: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcroatAgrave: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcroatAmacron: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcroatAogonek: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcroatAring: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcroatAtilde: [
		-40,
		-40,
		-40,
		-40,
		-35,
		-25,
		-35,
		-40
	],
	DcroatV: [
		-40,
		-40,
		-70,
		-70,
		-40,
		-50,
		-40,
		-40
	],
	DcroatW: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-30
	],
	DcroatY: [
		-70,
		-70,
		-90,
		-90,
		-40,
		-50,
		-40,
		-55
	],
	DcroatYacute: [
		-70,
		-70,
		-90,
		-90,
		-40,
		-50,
		-40,
		-55
	],
	DcroatYdieresis: [
		-70,
		-70,
		-90,
		-90,
		-40,
		-50,
		-40,
		-55
	],
	Dcroatcomma: [
		-30,
		-30,
		-70,
		-70
	],
	Dcroatperiod: [
		-30,
		-30,
		-70,
		-70,
		-20
	],
	FA: [
		-80,
		-80,
		-80,
		-80,
		-90,
		-100,
		-115,
		-74
	],
	FAacute: [
		-80,
		-80,
		-80,
		-80,
		-90,
		-100,
		-115,
		-74
	],
	FAbreve: [
		-80,
		-80,
		-80,
		-80,
		-90,
		-100,
		-115,
		-74
	],
	FAcircumflex: [
		-80,
		-80,
		-80,
		-80,
		-90,
		-100,
		-115,
		-74
	],
	FAdieresis: [
		-80,
		-80,
		-80,
		-80,
		-90,
		-100,
		-115,
		-74
	],
	FAgrave: [
		-80,
		-80,
		-80,
		-80,
		-90,
		-100,
		-115,
		-74
	],
	FAmacron: [
		-80,
		-80,
		-80,
		-80,
		-90,
		-100,
		-115,
		-74
	],
	FAogonek: [
		-80,
		-80,
		-80,
		-80,
		-90,
		-100,
		-115,
		-74
	],
	FAring: [
		-80,
		-80,
		-80,
		-80,
		-90,
		-100,
		-115,
		-74
	],
	FAtilde: [
		-80,
		-80,
		-80,
		-80,
		-90,
		-100,
		-115,
		-74
	],
	Fa: [
		-20,
		-20,
		-50,
		-50,
		-25,
		-95,
		-75,
		-15
	],
	Faacute: [
		-20,
		-20,
		-50,
		-50,
		-25,
		-95,
		-75,
		-15
	],
	Fabreve: [
		-20,
		-20,
		-50,
		-50,
		-25,
		-95,
		-75,
		-15
	],
	Facircumflex: [
		-20,
		-20,
		-50,
		-50,
		-25,
		-95,
		-75,
		-15
	],
	Fadieresis: [
		-20,
		-20,
		-50,
		-50,
		-25,
		-95,
		-75,
		-15
	],
	Fagrave: [
		-20,
		-20,
		-50,
		-50,
		-25,
		-95,
		-75,
		-15
	],
	Famacron: [
		-20,
		-20,
		-50,
		-50,
		-25,
		-95,
		-75,
		-15
	],
	Faogonek: [
		-20,
		-20,
		-50,
		-50,
		-25,
		-95,
		-75,
		-15
	],
	Faring: [
		-20,
		-20,
		-50,
		-50,
		-25,
		-95,
		-75,
		-15
	],
	Fatilde: [
		-20,
		-20,
		-50,
		-50,
		-25,
		-95,
		-75,
		-15
	],
	Fcomma: [
		-100,
		-100,
		-150,
		-150,
		-92,
		-129,
		-135,
		-80
	],
	Fperiod: [
		-100,
		-100,
		-150,
		-150,
		-110,
		-129,
		-135,
		-80
	],
	JA: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-25,
		-40,
		-60
	],
	JAacute: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-25,
		-40,
		-60
	],
	JAbreve: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-25,
		-40,
		-60
	],
	JAcircumflex: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-25,
		-40,
		-60
	],
	JAdieresis: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-25,
		-40,
		-60
	],
	JAgrave: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-25,
		-40,
		-60
	],
	JAmacron: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-25,
		-40,
		-60
	],
	JAogonek: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-25,
		-40,
		-60
	],
	JAring: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-25,
		-40,
		-60
	],
	JAtilde: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-25,
		-40,
		-60
	],
	Jcomma: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		-25
	],
	Jperiod: [
		-20,
		-20,
		-30,
		-30,
		-20,
		-10,
		-25
	],
	Ju: [
		-20,
		-20,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Juacute: [
		-20,
		-20,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Jucircumflex: [
		-20,
		-20,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Judieresis: [
		-20,
		-20,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Jugrave: [
		-20,
		-20,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Juhungarumlaut: [
		-20,
		-20,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Jumacron: [
		-20,
		-20,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Juogonek: [
		-20,
		-20,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Juring: [
		-20,
		-20,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	KO: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KOacute: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KOcircumflex: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KOdieresis: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KOgrave: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KOhungarumlaut: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KOmacron: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KOslash: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KOtilde: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	Ke: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Keacute: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kecaron: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kecircumflex: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kedieresis: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kedotaccent: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kegrave: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kemacron: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Keogonek: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Ko: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Koacute: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kocircumflex: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kodieresis: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kograve: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kohungarumlaut: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Komacron: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Koslash: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kotilde: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Ku: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kuacute: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kucircumflex: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kudieresis: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kugrave: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kuhungarumlaut: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kumacron: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kuogonek: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kuring: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Ky: [
		-40,
		-40,
		-50,
		-50,
		-45,
		-20,
		-40,
		-25
	],
	Kyacute: [
		-40,
		-40,
		-50,
		-50,
		-45,
		-20,
		-40,
		-25
	],
	Kydieresis: [
		-40,
		-40,
		-50,
		-50,
		-45,
		-20,
		-40,
		-25
	],
	KcommaaccentO: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KcommaaccentOacute: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KcommaaccentOcircumflex: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KcommaaccentOdieresis: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KcommaaccentOgrave: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KcommaaccentOhungarumlaut: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KcommaaccentOmacron: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KcommaaccentOslash: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	KcommaaccentOtilde: [
		-30,
		-30,
		-50,
		-50,
		-30,
		-30,
		-50,
		-30
	],
	Kcommaaccente: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kcommaaccenteacute: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kcommaaccentecaron: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kcommaaccentecircumflex: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kcommaaccentedieresis: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kcommaaccentedotaccent: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kcommaaccentegrave: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kcommaaccentemacron: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kcommaaccenteogonek: [
		-15,
		-15,
		-40,
		-40,
		-25,
		-25,
		-35,
		-25
	],
	Kcommaaccento: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kcommaaccentoacute: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kcommaaccentocircumflex: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kcommaaccentodieresis: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kcommaaccentograve: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kcommaaccentohungarumlaut: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kcommaaccentomacron: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kcommaaccentoslash: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kcommaaccentotilde: [
		-35,
		-35,
		-40,
		-40,
		-25,
		-25,
		-40,
		-35
	],
	Kcommaaccentu: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kcommaaccentuacute: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kcommaaccentucircumflex: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kcommaaccentudieresis: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kcommaaccentugrave: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kcommaaccentuhungarumlaut: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kcommaaccentumacron: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kcommaaccentuogonek: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kcommaaccenturing: [
		-30,
		-30,
		-30,
		-30,
		-15,
		-20,
		-40,
		-15
	],
	Kcommaaccenty: [
		-40,
		-40,
		-50,
		-50,
		-45,
		-20,
		-40,
		-25
	],
	Kcommaaccentyacute: [
		-40,
		-40,
		-50,
		-50,
		-45,
		-20,
		-40,
		-25
	],
	Kcommaaccentydieresis: [
		-40,
		-40,
		-50,
		-50,
		-45,
		-20,
		-40,
		-25
	],
	LT: [
		-90,
		-90,
		-110,
		-110,
		-92,
		-18,
		-20,
		-92
	],
	LTcaron: [
		-90,
		-90,
		-110,
		-110,
		-92,
		-18,
		-20,
		-92
	],
	LTcommaaccent: [
		-90,
		-90,
		-110,
		-110,
		-92,
		-18,
		-20,
		-92
	],
	LV: [
		-110,
		-110,
		-110,
		-110,
		-92,
		-37,
		-55,
		-100
	],
	LW: [
		-80,
		-80,
		-70,
		-70,
		-92,
		-37,
		-55,
		-74
	],
	LY: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-37,
		-20,
		-100
	],
	LYacute: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-37,
		-20,
		-100
	],
	LYdieresis: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-37,
		-20,
		-100
	],
	Lquotedblright: [
		-140,
		-140,
		-140,
		-140,
		-20
	],
	Lquoteright: [
		-140,
		-140,
		-160,
		-160,
		-110,
		-55,
		-37,
		-92
	],
	Ly: [
		-30,
		-30,
		-30,
		-30,
		-55,
		-37,
		-30,
		-55
	],
	Lyacute: [
		-30,
		-30,
		-30,
		-30,
		-55,
		-37,
		-30,
		-55
	],
	Lydieresis: [
		-30,
		-30,
		-30,
		-30,
		-55,
		-37,
		-30,
		-55
	],
	LacuteT: [
		-90,
		-90,
		-110,
		-110,
		-92,
		-18,
		-20,
		-92
	],
	LacuteTcaron: [
		-90,
		-90,
		-110,
		-110,
		-92,
		-18,
		-20,
		-92
	],
	LacuteTcommaaccent: [
		-90,
		-90,
		-110,
		-110,
		-92,
		-18,
		-20,
		-92
	],
	LacuteV: [
		-110,
		-110,
		-110,
		-110,
		-92,
		-37,
		-55,
		-100
	],
	LacuteW: [
		-80,
		-80,
		-70,
		-70,
		-92,
		-37,
		-55,
		-74
	],
	LacuteY: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-37,
		-20,
		-100
	],
	LacuteYacute: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-37,
		-20,
		-100
	],
	LacuteYdieresis: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-37,
		-20,
		-100
	],
	Lacutequotedblright: [
		-140,
		-140,
		-140,
		-140,
		-20
	],
	Lacutequoteright: [
		-140,
		-140,
		-160,
		-160,
		-110,
		-55,
		-37,
		-92
	],
	Lacutey: [
		-30,
		-30,
		-30,
		-30,
		-55,
		-37,
		-30,
		-55
	],
	Lacuteyacute: [
		-30,
		-30,
		-30,
		-30,
		-55,
		-37,
		-30,
		-55
	],
	Lacuteydieresis: [
		-30,
		-30,
		-30,
		-30,
		-55,
		-37,
		-30,
		-55
	],
	LcommaaccentT: [
		-90,
		-90,
		-110,
		-110,
		-92,
		-18,
		-20,
		-92
	],
	LcommaaccentTcaron: [
		-90,
		-90,
		-110,
		-110,
		-92,
		-18,
		-20,
		-92
	],
	LcommaaccentTcommaaccent: [
		-90,
		-90,
		-110,
		-110,
		-92,
		-18,
		-20,
		-92
	],
	LcommaaccentV: [
		-110,
		-110,
		-110,
		-110,
		-92,
		-37,
		-55,
		-100
	],
	LcommaaccentW: [
		-80,
		-80,
		-70,
		-70,
		-92,
		-37,
		-55,
		-74
	],
	LcommaaccentY: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-37,
		-20,
		-100
	],
	LcommaaccentYacute: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-37,
		-20,
		-100
	],
	LcommaaccentYdieresis: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-37,
		-20,
		-100
	],
	Lcommaaccentquotedblright: [
		-140,
		-140,
		-140,
		-140,
		-20
	],
	Lcommaaccentquoteright: [
		-140,
		-140,
		-160,
		-160,
		-110,
		-55,
		-37,
		-92
	],
	Lcommaaccenty: [
		-30,
		-30,
		-30,
		-30,
		-55,
		-37,
		-30,
		-55
	],
	Lcommaaccentyacute: [
		-30,
		-30,
		-30,
		-30,
		-55,
		-37,
		-30,
		-55
	],
	Lcommaaccentydieresis: [
		-30,
		-30,
		-30,
		-30,
		-55,
		-37,
		-30,
		-55
	],
	LslashT: [
		-90,
		-90,
		-110,
		-110,
		-92,
		-18,
		-20,
		-92
	],
	LslashTcaron: [
		-90,
		-90,
		-110,
		-110,
		-92,
		-18,
		-20,
		-92
	],
	LslashTcommaaccent: [
		-90,
		-90,
		-110,
		-110,
		-92,
		-18,
		-20,
		-92
	],
	LslashV: [
		-110,
		-110,
		-110,
		-110,
		-92,
		-37,
		-55,
		-100
	],
	LslashW: [
		-80,
		-80,
		-70,
		-70,
		-92,
		-37,
		-55,
		-74
	],
	LslashY: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-37,
		-20,
		-100
	],
	LslashYacute: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-37,
		-20,
		-100
	],
	LslashYdieresis: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-37,
		-20,
		-100
	],
	Lslashquotedblright: [
		-140,
		-140,
		-140,
		-140,
		-20
	],
	Lslashquoteright: [
		-140,
		-140,
		-160,
		-160,
		-110,
		-55,
		-37,
		-92
	],
	Lslashy: [
		-30,
		-30,
		-30,
		-30,
		-55,
		-37,
		-30,
		-55
	],
	Lslashyacute: [
		-30,
		-30,
		-30,
		-30,
		-55,
		-37,
		-30,
		-55
	],
	Lslashydieresis: [
		-30,
		-30,
		-30,
		-30,
		-55,
		-37,
		-30,
		-55
	],
	OA: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OAacute: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OAbreve: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OAcircumflex: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OAdieresis: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OAgrave: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OAmacron: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OAogonek: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OAring: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OAtilde: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OT: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OTcaron: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OTcommaaccent: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OV: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50
	],
	OW: [
		-50,
		-50,
		-30,
		-30,
		-50,
		-50,
		-50,
		-35
	],
	OX: [
		-50,
		-50,
		-60,
		-60,
		-40,
		-40,
		-40,
		-40
	],
	OY: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OYacute: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OYdieresis: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	Ocomma: [
		-40,
		-40,
		-40,
		-40
	],
	Operiod: [
		-40,
		-40,
		-40,
		-40
	],
	OacuteA: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OacuteAacute: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OacuteAbreve: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OacuteAcircumflex: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OacuteAdieresis: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OacuteAgrave: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OacuteAmacron: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OacuteAogonek: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OacuteAring: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OacuteAtilde: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OacuteT: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OacuteTcaron: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OacuteTcommaaccent: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OacuteV: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50
	],
	OacuteW: [
		-50,
		-50,
		-30,
		-30,
		-50,
		-50,
		-50,
		-35
	],
	OacuteX: [
		-50,
		-50,
		-60,
		-60,
		-40,
		-40,
		-40,
		-40
	],
	OacuteY: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OacuteYacute: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OacuteYdieresis: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	Oacutecomma: [
		-40,
		-40,
		-40,
		-40
	],
	Oacuteperiod: [
		-40,
		-40,
		-40,
		-40
	],
	OcircumflexA: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OcircumflexAacute: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OcircumflexAbreve: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OcircumflexAcircumflex: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OcircumflexAdieresis: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OcircumflexAgrave: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OcircumflexAmacron: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OcircumflexAogonek: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OcircumflexAring: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OcircumflexAtilde: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OcircumflexT: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OcircumflexTcaron: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OcircumflexTcommaaccent: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OcircumflexV: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50
	],
	OcircumflexW: [
		-50,
		-50,
		-30,
		-30,
		-50,
		-50,
		-50,
		-35
	],
	OcircumflexX: [
		-50,
		-50,
		-60,
		-60,
		-40,
		-40,
		-40,
		-40
	],
	OcircumflexY: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OcircumflexYacute: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OcircumflexYdieresis: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	Ocircumflexcomma: [
		-40,
		-40,
		-40,
		-40
	],
	Ocircumflexperiod: [
		-40,
		-40,
		-40,
		-40
	],
	OdieresisA: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OdieresisAacute: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OdieresisAbreve: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OdieresisAcircumflex: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OdieresisAdieresis: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OdieresisAgrave: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OdieresisAmacron: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OdieresisAogonek: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OdieresisAring: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OdieresisAtilde: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OdieresisT: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OdieresisTcaron: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OdieresisTcommaaccent: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OdieresisV: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50
	],
	OdieresisW: [
		-50,
		-50,
		-30,
		-30,
		-50,
		-50,
		-50,
		-35
	],
	OdieresisX: [
		-50,
		-50,
		-60,
		-60,
		-40,
		-40,
		-40,
		-40
	],
	OdieresisY: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OdieresisYacute: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OdieresisYdieresis: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	Odieresiscomma: [
		-40,
		-40,
		-40,
		-40
	],
	Odieresisperiod: [
		-40,
		-40,
		-40,
		-40
	],
	OgraveA: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OgraveAacute: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OgraveAbreve: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OgraveAcircumflex: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OgraveAdieresis: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OgraveAgrave: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OgraveAmacron: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OgraveAogonek: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OgraveAring: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OgraveAtilde: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OgraveT: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OgraveTcaron: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OgraveTcommaaccent: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OgraveV: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50
	],
	OgraveW: [
		-50,
		-50,
		-30,
		-30,
		-50,
		-50,
		-50,
		-35
	],
	OgraveX: [
		-50,
		-50,
		-60,
		-60,
		-40,
		-40,
		-40,
		-40
	],
	OgraveY: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OgraveYacute: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OgraveYdieresis: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	Ogravecomma: [
		-40,
		-40,
		-40,
		-40
	],
	Ograveperiod: [
		-40,
		-40,
		-40,
		-40
	],
	OhungarumlautA: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OhungarumlautAacute: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OhungarumlautAbreve: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OhungarumlautAcircumflex: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OhungarumlautAdieresis: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OhungarumlautAgrave: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OhungarumlautAmacron: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OhungarumlautAogonek: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OhungarumlautAring: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OhungarumlautAtilde: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OhungarumlautT: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OhungarumlautTcaron: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OhungarumlautTcommaaccent: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OhungarumlautV: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50
	],
	OhungarumlautW: [
		-50,
		-50,
		-30,
		-30,
		-50,
		-50,
		-50,
		-35
	],
	OhungarumlautX: [
		-50,
		-50,
		-60,
		-60,
		-40,
		-40,
		-40,
		-40
	],
	OhungarumlautY: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OhungarumlautYacute: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OhungarumlautYdieresis: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	Ohungarumlautcomma: [
		-40,
		-40,
		-40,
		-40
	],
	Ohungarumlautperiod: [
		-40,
		-40,
		-40,
		-40
	],
	OmacronA: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OmacronAacute: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OmacronAbreve: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OmacronAcircumflex: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OmacronAdieresis: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OmacronAgrave: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OmacronAmacron: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OmacronAogonek: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OmacronAring: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OmacronAtilde: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OmacronT: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OmacronTcaron: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OmacronTcommaaccent: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OmacronV: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50
	],
	OmacronW: [
		-50,
		-50,
		-30,
		-30,
		-50,
		-50,
		-50,
		-35
	],
	OmacronX: [
		-50,
		-50,
		-60,
		-60,
		-40,
		-40,
		-40,
		-40
	],
	OmacronY: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OmacronYacute: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OmacronYdieresis: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	Omacroncomma: [
		-40,
		-40,
		-40,
		-40
	],
	Omacronperiod: [
		-40,
		-40,
		-40,
		-40
	],
	OslashA: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OslashAacute: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OslashAbreve: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OslashAcircumflex: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OslashAdieresis: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OslashAgrave: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OslashAmacron: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OslashAogonek: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OslashAring: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OslashAtilde: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OslashT: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OslashTcaron: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OslashTcommaaccent: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OslashV: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50
	],
	OslashW: [
		-50,
		-50,
		-30,
		-30,
		-50,
		-50,
		-50,
		-35
	],
	OslashX: [
		-50,
		-50,
		-60,
		-60,
		-40,
		-40,
		-40,
		-40
	],
	OslashY: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OslashYacute: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OslashYdieresis: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	Oslashcomma: [
		-40,
		-40,
		-40,
		-40
	],
	Oslashperiod: [
		-40,
		-40,
		-40,
		-40
	],
	OtildeA: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OtildeAacute: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OtildeAbreve: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OtildeAcircumflex: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OtildeAdieresis: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OtildeAgrave: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OtildeAmacron: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OtildeAogonek: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OtildeAring: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OtildeAtilde: [
		-50,
		-50,
		-20,
		-20,
		-40,
		-40,
		-55,
		-35
	],
	OtildeT: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OtildeTcaron: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OtildeTcommaaccent: [
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	OtildeV: [
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50,
		-50
	],
	OtildeW: [
		-50,
		-50,
		-30,
		-30,
		-50,
		-50,
		-50,
		-35
	],
	OtildeX: [
		-50,
		-50,
		-60,
		-60,
		-40,
		-40,
		-40,
		-40
	],
	OtildeY: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OtildeYacute: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	OtildeYdieresis: [
		-70,
		-70,
		-70,
		-70,
		-50,
		-50,
		-50,
		-50
	],
	Otildecomma: [
		-40,
		-40,
		-40,
		-40
	],
	Otildeperiod: [
		-40,
		-40,
		-40,
		-40
	],
	PA: [
		-100,
		-100,
		-120,
		-120,
		-74,
		-85,
		-90,
		-92
	],
	PAacute: [
		-100,
		-100,
		-120,
		-120,
		-74,
		-85,
		-90,
		-92
	],
	PAbreve: [
		-100,
		-100,
		-120,
		-120,
		-74,
		-85,
		-90,
		-92
	],
	PAcircumflex: [
		-100,
		-100,
		-120,
		-120,
		-74,
		-85,
		-90,
		-92
	],
	PAdieresis: [
		-100,
		-100,
		-120,
		-120,
		-74,
		-85,
		-90,
		-92
	],
	PAgrave: [
		-100,
		-100,
		-120,
		-120,
		-74,
		-85,
		-90,
		-92
	],
	PAmacron: [
		-100,
		-100,
		-120,
		-120,
		-74,
		-85,
		-90,
		-92
	],
	PAogonek: [
		-100,
		-100,
		-120,
		-120,
		-74,
		-85,
		-90,
		-92
	],
	PAring: [
		-100,
		-100,
		-120,
		-120,
		-74,
		-85,
		-90,
		-92
	],
	PAtilde: [
		-100,
		-100,
		-120,
		-120,
		-74,
		-85,
		-90,
		-92
	],
	Pa: [
		-30,
		-30,
		-40,
		-40,
		-10,
		-40,
		-80,
		-15
	],
	Paacute: [
		-30,
		-30,
		-40,
		-40,
		-10,
		-40,
		-80,
		-15
	],
	Pabreve: [
		-30,
		-30,
		-40,
		-40,
		-10,
		-40,
		-80,
		-15
	],
	Pacircumflex: [
		-30,
		-30,
		-40,
		-40,
		-10,
		-40,
		-80,
		-15
	],
	Padieresis: [
		-30,
		-30,
		-40,
		-40,
		-10,
		-40,
		-80,
		-15
	],
	Pagrave: [
		-30,
		-30,
		-40,
		-40,
		-10,
		-40,
		-80,
		-15
	],
	Pamacron: [
		-30,
		-30,
		-40,
		-40,
		-10,
		-40,
		-80,
		-15
	],
	Paogonek: [
		-30,
		-30,
		-40,
		-40,
		-10,
		-40,
		-80,
		-15
	],
	Paring: [
		-30,
		-30,
		-40,
		-40,
		-10,
		-40,
		-80,
		-15
	],
	Patilde: [
		-30,
		-30,
		-40,
		-40,
		-10,
		-40,
		-80,
		-15
	],
	Pcomma: [
		-120,
		-120,
		-180,
		-180,
		-92,
		-129,
		-135,
		-111
	],
	Pe: [
		-30,
		-30,
		-50,
		-50,
		-20,
		-50,
		-80
	],
	Peacute: [
		-30,
		-30,
		-50,
		-50,
		-20,
		-50,
		-80
	],
	Pecaron: [
		-30,
		-30,
		-50,
		-50,
		-20,
		-50,
		-80
	],
	Pecircumflex: [
		-30,
		-30,
		-50,
		-50,
		-20,
		-50,
		-80
	],
	Pedieresis: [
		-30,
		-30,
		-50,
		-50,
		-20,
		-50,
		-80
	],
	Pedotaccent: [
		-30,
		-30,
		-50,
		-50,
		-20,
		-50,
		-80
	],
	Pegrave: [
		-30,
		-30,
		-50,
		-50,
		-20,
		-50,
		-80
	],
	Pemacron: [
		-30,
		-30,
		-50,
		-50,
		-20,
		-50,
		-80
	],
	Peogonek: [
		-30,
		-30,
		-50,
		-50,
		-20,
		-50,
		-80
	],
	Po: [
		-40,
		-40,
		-50,
		-50,
		-20,
		-55,
		-80
	],
	Poacute: [
		-40,
		-40,
		-50,
		-50,
		-20,
		-55,
		-80
	],
	Pocircumflex: [
		-40,
		-40,
		-50,
		-50,
		-20,
		-55,
		-80
	],
	Podieresis: [
		-40,
		-40,
		-50,
		-50,
		-20,
		-55,
		-80
	],
	Pograve: [
		-40,
		-40,
		-50,
		-50,
		-20,
		-55,
		-80
	],
	Pohungarumlaut: [
		-40,
		-40,
		-50,
		-50,
		-20,
		-55,
		-80
	],
	Pomacron: [
		-40,
		-40,
		-50,
		-50,
		-20,
		-55,
		-80
	],
	Poslash: [
		-40,
		-40,
		-50,
		-50,
		-20,
		-55,
		-80
	],
	Potilde: [
		-40,
		-40,
		-50,
		-50,
		-20,
		-55,
		-80
	],
	Pperiod: [
		-120,
		-120,
		-180,
		-180,
		-110,
		-129,
		-135,
		-111
	],
	QU: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	QUacute: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	QUcircumflex: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	QUdieresis: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	QUgrave: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	QUhungarumlaut: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	QUmacron: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	QUogonek: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	QUring: [
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10,
		-10
	],
	Qcomma: [
		20,
		20
	],
	Qperiod: [
		20,
		20,
		0,
		0,
		-20
	],
	RO: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	ROacute: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	ROcircumflex: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	ROdieresis: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	ROgrave: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	ROhungarumlaut: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	ROmacron: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	ROslash: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	ROtilde: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RT: [
		-20,
		-20,
		-30,
		-30,
		-40,
		-30,
		0,
		-60
	],
	RTcaron: [
		-20,
		-20,
		-30,
		-30,
		-40,
		-30,
		0,
		-60
	],
	RTcommaaccent: [
		-20,
		-20,
		-30,
		-30,
		-40,
		-30,
		0,
		-60
	],
	RU: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RUacute: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RUcircumflex: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RUdieresis: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RUgrave: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RUhungarumlaut: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RUmacron: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RUogonek: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RUring: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RV: [
		-50,
		-50,
		-50,
		-50,
		-55,
		-18,
		-18,
		-80
	],
	RW: [
		-40,
		-40,
		-30,
		-30,
		-35,
		-18,
		-18,
		-55
	],
	RY: [
		-50,
		-50,
		-50,
		-50,
		-35,
		-18,
		-18,
		-65
	],
	RYacute: [
		-50,
		-50,
		-50,
		-50,
		-35,
		-18,
		-18,
		-65
	],
	RYdieresis: [
		-50,
		-50,
		-50,
		-50,
		-35,
		-18,
		-18,
		-65
	],
	RacuteO: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RacuteOacute: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RacuteOcircumflex: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RacuteOdieresis: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RacuteOgrave: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RacuteOhungarumlaut: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RacuteOmacron: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RacuteOslash: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RacuteOtilde: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RacuteT: [
		-20,
		-20,
		-30,
		-30,
		-40,
		-30,
		0,
		-60
	],
	RacuteTcaron: [
		-20,
		-20,
		-30,
		-30,
		-40,
		-30,
		0,
		-60
	],
	RacuteTcommaaccent: [
		-20,
		-20,
		-30,
		-30,
		-40,
		-30,
		0,
		-60
	],
	RacuteU: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RacuteUacute: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RacuteUcircumflex: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RacuteUdieresis: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RacuteUgrave: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RacuteUhungarumlaut: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RacuteUmacron: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RacuteUogonek: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RacuteUring: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RacuteV: [
		-50,
		-50,
		-50,
		-50,
		-55,
		-18,
		-18,
		-80
	],
	RacuteW: [
		-40,
		-40,
		-30,
		-30,
		-35,
		-18,
		-18,
		-55
	],
	RacuteY: [
		-50,
		-50,
		-50,
		-50,
		-35,
		-18,
		-18,
		-65
	],
	RacuteYacute: [
		-50,
		-50,
		-50,
		-50,
		-35,
		-18,
		-18,
		-65
	],
	RacuteYdieresis: [
		-50,
		-50,
		-50,
		-50,
		-35,
		-18,
		-18,
		-65
	],
	RcaronO: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcaronOacute: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcaronOcircumflex: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcaronOdieresis: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcaronOgrave: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcaronOhungarumlaut: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcaronOmacron: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcaronOslash: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcaronOtilde: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcaronT: [
		-20,
		-20,
		-30,
		-30,
		-40,
		-30,
		0,
		-60
	],
	RcaronTcaron: [
		-20,
		-20,
		-30,
		-30,
		-40,
		-30,
		0,
		-60
	],
	RcaronTcommaaccent: [
		-20,
		-20,
		-30,
		-30,
		-40,
		-30,
		0,
		-60
	],
	RcaronU: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcaronUacute: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcaronUcircumflex: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcaronUdieresis: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcaronUgrave: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcaronUhungarumlaut: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcaronUmacron: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcaronUogonek: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcaronUring: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcaronV: [
		-50,
		-50,
		-50,
		-50,
		-55,
		-18,
		-18,
		-80
	],
	RcaronW: [
		-40,
		-40,
		-30,
		-30,
		-35,
		-18,
		-18,
		-55
	],
	RcaronY: [
		-50,
		-50,
		-50,
		-50,
		-35,
		-18,
		-18,
		-65
	],
	RcaronYacute: [
		-50,
		-50,
		-50,
		-50,
		-35,
		-18,
		-18,
		-65
	],
	RcaronYdieresis: [
		-50,
		-50,
		-50,
		-50,
		-35,
		-18,
		-18,
		-65
	],
	RcommaaccentO: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentOacute: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentOcircumflex: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentOdieresis: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentOgrave: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentOhungarumlaut: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentOmacron: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentOslash: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentOtilde: [
		-20,
		-20,
		-20,
		-20,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentT: [
		-20,
		-20,
		-30,
		-30,
		-40,
		-30,
		0,
		-60
	],
	RcommaaccentTcaron: [
		-20,
		-20,
		-30,
		-30,
		-40,
		-30,
		0,
		-60
	],
	RcommaaccentTcommaaccent: [
		-20,
		-20,
		-30,
		-30,
		-40,
		-30,
		0,
		-60
	],
	RcommaaccentU: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentUacute: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentUcircumflex: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentUdieresis: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentUgrave: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentUhungarumlaut: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentUmacron: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentUogonek: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentUring: [
		-20,
		-20,
		-40,
		-40,
		-30,
		-40,
		-40,
		-40
	],
	RcommaaccentV: [
		-50,
		-50,
		-50,
		-50,
		-55,
		-18,
		-18,
		-80
	],
	RcommaaccentW: [
		-40,
		-40,
		-30,
		-30,
		-35,
		-18,
		-18,
		-55
	],
	RcommaaccentY: [
		-50,
		-50,
		-50,
		-50,
		-35,
		-18,
		-18,
		-65
	],
	RcommaaccentYacute: [
		-50,
		-50,
		-50,
		-50,
		-35,
		-18,
		-18,
		-65
	],
	RcommaaccentYdieresis: [
		-50,
		-50,
		-50,
		-50,
		-35,
		-18,
		-18,
		-65
	],
	TA: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TAacute: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TAbreve: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TAcircumflex: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TAdieresis: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TAgrave: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TAmacron: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TAogonek: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TAring: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TAtilde: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TO: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TOacute: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TOcircumflex: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TOdieresis: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TOgrave: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TOhungarumlaut: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TOmacron: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TOslash: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TOtilde: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	Ta: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-92,
		-92,
		-80
	],
	Taacute: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-92,
		-92,
		-80
	],
	Tabreve: [
		-80,
		-80,
		-60,
		-60,
		-52,
		-92,
		-92,
		-80
	],
	Tacircumflex: [
		-80,
		-80,
		-120,
		-120,
		-52,
		-92,
		-92,
		-80
	],
	Tadieresis: [
		-80,
		-80,
		-120,
		-120,
		-52,
		-92,
		-92,
		-40
	],
	Tagrave: [
		-80,
		-80,
		-120,
		-120,
		-52,
		-92,
		-92,
		-40
	],
	Tamacron: [
		-80,
		-80,
		-60,
		-60,
		-52,
		-92,
		-92,
		-40
	],
	Taogonek: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-92,
		-92,
		-80
	],
	Taring: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-92,
		-92,
		-80
	],
	Tatilde: [
		-80,
		-80,
		-60,
		-60,
		-52,
		-92,
		-92,
		-40
	],
	Tcolon: [
		-40,
		-40,
		-20,
		-20,
		-74,
		-74,
		-55,
		-50
	],
	Tcomma: [
		-80,
		-80,
		-120,
		-120,
		-74,
		-92,
		-74,
		-74
	],
	Te: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Teacute: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Tecaron: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Tecircumflex: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-52,
		-70
	],
	Tedieresis: [
		-60,
		-60,
		-120,
		-120,
		-52,
		-52,
		-52,
		-30
	],
	Tedotaccent: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Tegrave: [
		-60,
		-60,
		-60,
		-60,
		-52,
		-52,
		-52,
		-70
	],
	Temacron: [
		-60,
		-60,
		-60,
		-60,
		-52,
		-52,
		-52,
		-30
	],
	Teogonek: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Thyphen: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-92,
		-74,
		-92
	],
	To: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Toacute: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tocircumflex: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Todieresis: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tograve: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tohungarumlaut: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tomacron: [
		-80,
		-80,
		-60,
		-60,
		-92,
		-95,
		-92,
		-80
	],
	Toslash: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Totilde: [
		-80,
		-80,
		-60,
		-60,
		-92,
		-95,
		-92,
		-80
	],
	Tperiod: [
		-80,
		-80,
		-120,
		-120,
		-90,
		-92,
		-74,
		-74
	],
	Tr: [
		-80,
		-80,
		-120,
		-120,
		-74,
		-37,
		-55,
		-35
	],
	Tracute: [
		-80,
		-80,
		-120,
		-120,
		-74,
		-37,
		-55,
		-35
	],
	Trcommaaccent: [
		-80,
		-80,
		-120,
		-120,
		-74,
		-37,
		-55,
		-35
	],
	Tsemicolon: [
		-40,
		-40,
		-20,
		-20,
		-74,
		-74,
		-65,
		-55
	],
	Tu: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tuacute: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tucircumflex: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tudieresis: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tugrave: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tuhungarumlaut: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tumacron: [
		-90,
		-90,
		-60,
		-60,
		-92,
		-37,
		-55,
		-45
	],
	Tuogonek: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Turing: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tw: [
		-60,
		-60,
		-120,
		-120,
		-74,
		-37,
		-74,
		-80
	],
	Ty: [
		-60,
		-60,
		-120,
		-120,
		-34,
		-37,
		-74,
		-80
	],
	Tyacute: [
		-60,
		-60,
		-120,
		-120,
		-34,
		-37,
		-74,
		-80
	],
	Tydieresis: [
		-60,
		-60,
		-60,
		-60,
		-34,
		-37,
		-34,
		-80
	],
	TcaronA: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcaronAacute: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcaronAbreve: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcaronAcircumflex: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcaronAdieresis: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcaronAgrave: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcaronAmacron: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcaronAogonek: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcaronAring: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcaronAtilde: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcaronO: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcaronOacute: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcaronOcircumflex: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcaronOdieresis: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcaronOgrave: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcaronOhungarumlaut: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcaronOmacron: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcaronOslash: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcaronOtilde: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	Tcarona: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-92,
		-92,
		-80
	],
	Tcaronaacute: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-92,
		-92,
		-80
	],
	Tcaronabreve: [
		-80,
		-80,
		-60,
		-60,
		-52,
		-92,
		-92,
		-80
	],
	Tcaronacircumflex: [
		-80,
		-80,
		-120,
		-120,
		-52,
		-92,
		-92,
		-80
	],
	Tcaronadieresis: [
		-80,
		-80,
		-120,
		-120,
		-52,
		-92,
		-92,
		-40
	],
	Tcaronagrave: [
		-80,
		-80,
		-120,
		-120,
		-52,
		-92,
		-92,
		-40
	],
	Tcaronamacron: [
		-80,
		-80,
		-60,
		-60,
		-52,
		-92,
		-92,
		-40
	],
	Tcaronaogonek: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-92,
		-92,
		-80
	],
	Tcaronaring: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-92,
		-92,
		-80
	],
	Tcaronatilde: [
		-80,
		-80,
		-60,
		-60,
		-52,
		-92,
		-92,
		-40
	],
	Tcaroncolon: [
		-40,
		-40,
		-20,
		-20,
		-74,
		-74,
		-55,
		-50
	],
	Tcaroncomma: [
		-80,
		-80,
		-120,
		-120,
		-74,
		-92,
		-74,
		-74
	],
	Tcarone: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Tcaroneacute: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Tcaronecaron: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Tcaronecircumflex: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-52,
		-30
	],
	Tcaronedieresis: [
		-60,
		-60,
		-120,
		-120,
		-52,
		-52,
		-52,
		-30
	],
	Tcaronedotaccent: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Tcaronegrave: [
		-60,
		-60,
		-60,
		-60,
		-52,
		-52,
		-52,
		-70
	],
	Tcaronemacron: [
		-60,
		-60,
		-60,
		-60,
		-52,
		-52,
		-52,
		-30
	],
	Tcaroneogonek: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Tcaronhyphen: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-92,
		-74,
		-92
	],
	Tcarono: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcaronoacute: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcaronocircumflex: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcaronodieresis: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcaronograve: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcaronohungarumlaut: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcaronomacron: [
		-80,
		-80,
		-60,
		-60,
		-92,
		-95,
		-92,
		-80
	],
	Tcaronoslash: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcaronotilde: [
		-80,
		-80,
		-60,
		-60,
		-92,
		-95,
		-92,
		-80
	],
	Tcaronperiod: [
		-80,
		-80,
		-120,
		-120,
		-90,
		-92,
		-74,
		-74
	],
	Tcaronr: [
		-80,
		-80,
		-120,
		-120,
		-74,
		-37,
		-55,
		-35
	],
	Tcaronracute: [
		-80,
		-80,
		-120,
		-120,
		-74,
		-37,
		-55,
		-35
	],
	Tcaronrcommaaccent: [
		-80,
		-80,
		-120,
		-120,
		-74,
		-37,
		-55,
		-35
	],
	Tcaronsemicolon: [
		-40,
		-40,
		-20,
		-20,
		-74,
		-74,
		-65,
		-55
	],
	Tcaronu: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcaronuacute: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcaronucircumflex: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcaronudieresis: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcaronugrave: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcaronuhungarumlaut: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcaronumacron: [
		-90,
		-90,
		-60,
		-60,
		-92,
		-37,
		-55,
		-45
	],
	Tcaronuogonek: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcaronuring: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcaronw: [
		-60,
		-60,
		-120,
		-120,
		-74,
		-37,
		-74,
		-80
	],
	Tcarony: [
		-60,
		-60,
		-120,
		-120,
		-34,
		-37,
		-74,
		-80
	],
	Tcaronyacute: [
		-60,
		-60,
		-120,
		-120,
		-34,
		-37,
		-74,
		-80
	],
	Tcaronydieresis: [
		-60,
		-60,
		-60,
		-60,
		-34,
		-37,
		-34,
		-80
	],
	TcommaaccentA: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcommaaccentAacute: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcommaaccentAbreve: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcommaaccentAcircumflex: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcommaaccentAdieresis: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcommaaccentAgrave: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcommaaccentAmacron: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcommaaccentAogonek: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcommaaccentAring: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcommaaccentAtilde: [
		-90,
		-90,
		-120,
		-120,
		-90,
		-55,
		-50,
		-93
	],
	TcommaaccentO: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcommaaccentOacute: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcommaaccentOcircumflex: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcommaaccentOdieresis: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcommaaccentOgrave: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcommaaccentOhungarumlaut: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcommaaccentOmacron: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcommaaccentOslash: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	TcommaaccentOtilde: [
		-40,
		-40,
		-40,
		-40,
		-18,
		-18,
		-18,
		-18
	],
	Tcommaaccenta: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-92,
		-92,
		-80
	],
	Tcommaaccentaacute: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-92,
		-92,
		-80
	],
	Tcommaaccentabreve: [
		-80,
		-80,
		-60,
		-60,
		-52,
		-92,
		-92,
		-80
	],
	Tcommaaccentacircumflex: [
		-80,
		-80,
		-120,
		-120,
		-52,
		-92,
		-92,
		-80
	],
	Tcommaaccentadieresis: [
		-80,
		-80,
		-120,
		-120,
		-52,
		-92,
		-92,
		-40
	],
	Tcommaaccentagrave: [
		-80,
		-80,
		-120,
		-120,
		-52,
		-92,
		-92,
		-40
	],
	Tcommaaccentamacron: [
		-80,
		-80,
		-60,
		-60,
		-52,
		-92,
		-92,
		-40
	],
	Tcommaaccentaogonek: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-92,
		-92,
		-80
	],
	Tcommaaccentaring: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-92,
		-92,
		-80
	],
	Tcommaaccentatilde: [
		-80,
		-80,
		-60,
		-60,
		-52,
		-92,
		-92,
		-40
	],
	Tcommaaccentcolon: [
		-40,
		-40,
		-20,
		-20,
		-74,
		-74,
		-55,
		-50
	],
	Tcommaaccentcomma: [
		-80,
		-80,
		-120,
		-120,
		-74,
		-92,
		-74,
		-74
	],
	Tcommaaccente: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Tcommaaccenteacute: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Tcommaaccentecaron: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Tcommaaccentecircumflex: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-52,
		-30
	],
	Tcommaaccentedieresis: [
		-60,
		-60,
		-120,
		-120,
		-52,
		-52,
		-52,
		-30
	],
	Tcommaaccentedotaccent: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Tcommaaccentegrave: [
		-60,
		-60,
		-60,
		-60,
		-52,
		-52,
		-52,
		-30
	],
	Tcommaaccentemacron: [
		-60,
		-60,
		-60,
		-60,
		-52,
		-52,
		-52,
		-70
	],
	Tcommaaccenteogonek: [
		-60,
		-60,
		-120,
		-120,
		-92,
		-92,
		-92,
		-70
	],
	Tcommaaccenthyphen: [
		-120,
		-120,
		-140,
		-140,
		-92,
		-92,
		-74,
		-92
	],
	Tcommaaccento: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcommaaccentoacute: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcommaaccentocircumflex: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcommaaccentodieresis: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcommaaccentograve: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcommaaccentohungarumlaut: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcommaaccentomacron: [
		-80,
		-80,
		-60,
		-60,
		-92,
		-95,
		-92,
		-80
	],
	Tcommaaccentoslash: [
		-80,
		-80,
		-120,
		-120,
		-92,
		-95,
		-92,
		-80
	],
	Tcommaaccentotilde: [
		-80,
		-80,
		-60,
		-60,
		-92,
		-95,
		-92,
		-80
	],
	Tcommaaccentperiod: [
		-80,
		-80,
		-120,
		-120,
		-90,
		-92,
		-74,
		-74
	],
	Tcommaaccentr: [
		-80,
		-80,
		-120,
		-120,
		-74,
		-37,
		-55,
		-35
	],
	Tcommaaccentracute: [
		-80,
		-80,
		-120,
		-120,
		-74,
		-37,
		-55,
		-35
	],
	Tcommaaccentrcommaaccent: [
		-80,
		-80,
		-120,
		-120,
		-74,
		-37,
		-55,
		-35
	],
	Tcommaaccentsemicolon: [
		-40,
		-40,
		-20,
		-20,
		-74,
		-74,
		-65,
		-55
	],
	Tcommaaccentu: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcommaaccentuacute: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcommaaccentucircumflex: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcommaaccentudieresis: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcommaaccentugrave: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcommaaccentuhungarumlaut: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcommaaccentumacron: [
		-90,
		-90,
		-60,
		-60,
		-92,
		-37,
		-55,
		-45
	],
	Tcommaaccentuogonek: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcommaaccenturing: [
		-90,
		-90,
		-120,
		-120,
		-92,
		-37,
		-55,
		-45
	],
	Tcommaaccentw: [
		-60,
		-60,
		-120,
		-120,
		-74,
		-37,
		-74,
		-80
	],
	Tcommaaccenty: [
		-60,
		-60,
		-120,
		-120,
		-34,
		-37,
		-74,
		-80
	],
	Tcommaaccentyacute: [
		-60,
		-60,
		-120,
		-120,
		-34,
		-37,
		-74,
		-80
	],
	Tcommaaccentydieresis: [
		-60,
		-60,
		-60,
		-60,
		-34,
		-37,
		-34,
		-80
	],
	UA: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UAacute: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UAbreve: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UAcircumflex: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UAdieresis: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UAgrave: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UAmacron: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UAogonek: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UAring: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UAtilde: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	Ucomma: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	Uperiod: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	UacuteA: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UacuteAacute: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UacuteAbreve: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UacuteAcircumflex: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UacuteAdieresis: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UacuteAgrave: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UacuteAmacron: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UacuteAogonek: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UacuteAring: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UacuteAtilde: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	Uacutecomma: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	Uacuteperiod: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	UcircumflexA: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UcircumflexAacute: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UcircumflexAbreve: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UcircumflexAcircumflex: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UcircumflexAdieresis: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UcircumflexAgrave: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UcircumflexAmacron: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UcircumflexAogonek: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UcircumflexAring: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UcircumflexAtilde: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	Ucircumflexcomma: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	Ucircumflexperiod: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	UdieresisA: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UdieresisAacute: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UdieresisAbreve: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UdieresisAcircumflex: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UdieresisAdieresis: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UdieresisAgrave: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UdieresisAmacron: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UdieresisAogonek: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UdieresisAring: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UdieresisAtilde: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	Udieresiscomma: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	Udieresisperiod: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	UgraveA: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UgraveAacute: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UgraveAbreve: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UgraveAcircumflex: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UgraveAdieresis: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UgraveAgrave: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UgraveAmacron: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UgraveAogonek: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UgraveAring: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UgraveAtilde: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	Ugravecomma: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	Ugraveperiod: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	UhungarumlautA: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UhungarumlautAacute: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UhungarumlautAbreve: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UhungarumlautAcircumflex: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UhungarumlautAdieresis: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UhungarumlautAgrave: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UhungarumlautAmacron: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UhungarumlautAogonek: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UhungarumlautAring: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UhungarumlautAtilde: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	Uhungarumlautcomma: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	Uhungarumlautperiod: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	UmacronA: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UmacronAacute: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UmacronAbreve: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UmacronAcircumflex: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UmacronAdieresis: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UmacronAgrave: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UmacronAmacron: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UmacronAogonek: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UmacronAring: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UmacronAtilde: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	Umacroncomma: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	Umacronperiod: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	UogonekA: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UogonekAacute: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UogonekAbreve: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UogonekAcircumflex: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UogonekAdieresis: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UogonekAgrave: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UogonekAmacron: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UogonekAogonek: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UogonekAring: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UogonekAtilde: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	Uogonekcomma: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	Uogonekperiod: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	UringA: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UringAacute: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UringAbreve: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UringAcircumflex: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UringAdieresis: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UringAgrave: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UringAmacron: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UringAogonek: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UringAring: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	UringAtilde: [
		-50,
		-50,
		-40,
		-40,
		-60,
		-45,
		-40,
		-40
	],
	Uringcomma: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	Uringperiod: [
		-30,
		-30,
		-40,
		-40,
		-50,
		0,
		-25
	],
	VA: [
		-80,
		-80,
		-80,
		-80,
		-135,
		-85,
		-60,
		-135
	],
	VAacute: [
		-80,
		-80,
		-80,
		-80,
		-135,
		-85,
		-60,
		-135
	],
	VAbreve: [
		-80,
		-80,
		-80,
		-80,
		-135,
		-85,
		-60,
		-135
	],
	VAcircumflex: [
		-80,
		-80,
		-80,
		-80,
		-135,
		-85,
		-60,
		-135
	],
	VAdieresis: [
		-80,
		-80,
		-80,
		-80,
		-135,
		-85,
		-60,
		-135
	],
	VAgrave: [
		-80,
		-80,
		-80,
		-80,
		-135,
		-85,
		-60,
		-135
	],
	VAmacron: [
		-80,
		-80,
		-80,
		-80,
		-135,
		-85,
		-60,
		-135
	],
	VAogonek: [
		-80,
		-80,
		-80,
		-80,
		-135,
		-85,
		-60,
		-135
	],
	VAring: [
		-80,
		-80,
		-80,
		-80,
		-135,
		-85,
		-60,
		-135
	],
	VAtilde: [
		-80,
		-80,
		-80,
		-80,
		-135,
		-85,
		-60,
		-135
	],
	VG: [
		-50,
		-50,
		-40,
		-40,
		-30,
		-10,
		0,
		-15
	],
	VGbreve: [
		-50,
		-50,
		-40,
		-40,
		-30,
		-10,
		0,
		-15
	],
	VGcommaaccent: [
		-50,
		-50,
		-40,
		-40,
		-30,
		-10,
		0,
		-15
	],
	VO: [
		-50,
		-50,
		-40,
		-40,
		-45,
		-30,
		-30,
		-40
	],
	VOacute: [
		-50,
		-50,
		-40,
		-40,
		-45,
		-30,
		-30,
		-40
	],
	VOcircumflex: [
		-50,
		-50,
		-40,
		-40,
		-45,
		-30,
		-30,
		-40
	],
	VOdieresis: [
		-50,
		-50,
		-40,
		-40,
		-45,
		-30,
		-30,
		-40
	],
	VOgrave: [
		-50,
		-50,
		-40,
		-40,
		-45,
		-30,
		-30,
		-40
	],
	VOhungarumlaut: [
		-50,
		-50,
		-40,
		-40,
		-45,
		-30,
		-30,
		-40
	],
	VOmacron: [
		-50,
		-50,
		-40,
		-40,
		-45,
		-30,
		-30,
		-40
	],
	VOslash: [
		-50,
		-50,
		-40,
		-40,
		-45,
		-30,
		-30,
		-40
	],
	VOtilde: [
		-50,
		-50,
		-40,
		-40,
		-45,
		-30,
		-30,
		-40
	],
	Va: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-111,
		-111,
		-111
	],
	Vaacute: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-111,
		-111,
		-111
	],
	Vabreve: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-111,
		-111,
		-111
	],
	Vacircumflex: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-111,
		-111,
		-71
	],
	Vadieresis: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-111,
		-111,
		-71
	],
	Vagrave: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-111,
		-111,
		-71
	],
	Vamacron: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-111,
		-111,
		-71
	],
	Vaogonek: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-111,
		-111,
		-111
	],
	Varing: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-111,
		-111,
		-111
	],
	Vatilde: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-111,
		-111,
		-71
	],
	Vcolon: [
		-40,
		-40,
		-40,
		-40,
		-92,
		-74,
		-65,
		-74
	],
	Vcomma: [
		-120,
		-120,
		-125,
		-125,
		-129,
		-129,
		-129,
		-129
	],
	Ve: [
		-50,
		-50,
		-80,
		-80,
		-100,
		-111,
		-111,
		-111
	],
	Veacute: [
		-50,
		-50,
		-80,
		-80,
		-100,
		-111,
		-111,
		-111
	],
	Vecaron: [
		-50,
		-50,
		-80,
		-80,
		-100,
		-111,
		-111,
		-71
	],
	Vecircumflex: [
		-50,
		-50,
		-80,
		-80,
		-100,
		-111,
		-111,
		-71
	],
	Vedieresis: [
		-50,
		-50,
		-80,
		-80,
		-100,
		-71,
		-71,
		-71
	],
	Vedotaccent: [
		-50,
		-50,
		-80,
		-80,
		-100,
		-111,
		-111,
		-111
	],
	Vegrave: [
		-50,
		-50,
		-80,
		-80,
		-100,
		-71,
		-71,
		-71
	],
	Vemacron: [
		-50,
		-50,
		-80,
		-80,
		-100,
		-71,
		-71,
		-71
	],
	Veogonek: [
		-50,
		-50,
		-80,
		-80,
		-100,
		-111,
		-111,
		-111
	],
	Vhyphen: [
		-80,
		-80,
		-80,
		-80,
		-74,
		-70,
		-55,
		-100
	],
	Vo: [
		-90,
		-90,
		-80,
		-80,
		-100,
		-111,
		-111,
		-129
	],
	Voacute: [
		-90,
		-90,
		-80,
		-80,
		-100,
		-111,
		-111,
		-129
	],
	Vocircumflex: [
		-90,
		-90,
		-80,
		-80,
		-100,
		-111,
		-111,
		-129
	],
	Vodieresis: [
		-90,
		-90,
		-80,
		-80,
		-100,
		-111,
		-111,
		-89
	],
	Vograve: [
		-90,
		-90,
		-80,
		-80,
		-100,
		-111,
		-111,
		-89
	],
	Vohungarumlaut: [
		-90,
		-90,
		-80,
		-80,
		-100,
		-111,
		-111,
		-129
	],
	Vomacron: [
		-90,
		-90,
		-80,
		-80,
		-100,
		-111,
		-111,
		-89
	],
	Voslash: [
		-90,
		-90,
		-80,
		-80,
		-100,
		-111,
		-111,
		-129
	],
	Votilde: [
		-90,
		-90,
		-80,
		-80,
		-100,
		-111,
		-111,
		-89
	],
	Vperiod: [
		-120,
		-120,
		-125,
		-125,
		-145,
		-129,
		-129,
		-129
	],
	Vsemicolon: [
		-40,
		-40,
		-40,
		-40,
		-92,
		-74,
		-74,
		-74
	],
	Vu: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-55,
		-74,
		-75
	],
	Vuacute: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-55,
		-74,
		-75
	],
	Vucircumflex: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-55,
		-74,
		-75
	],
	Vudieresis: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-55,
		-74,
		-75
	],
	Vugrave: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-55,
		-74,
		-75
	],
	Vuhungarumlaut: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-55,
		-74,
		-75
	],
	Vumacron: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-55,
		-74,
		-75
	],
	Vuogonek: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-55,
		-74,
		-75
	],
	Vuring: [
		-60,
		-60,
		-70,
		-70,
		-92,
		-55,
		-74,
		-75
	],
	WA: [
		-60,
		-60,
		-50,
		-50,
		-120,
		-74,
		-60,
		-120
	],
	WAacute: [
		-60,
		-60,
		-50,
		-50,
		-120,
		-74,
		-60,
		-120
	],
	WAbreve: [
		-60,
		-60,
		-50,
		-50,
		-120,
		-74,
		-60,
		-120
	],
	WAcircumflex: [
		-60,
		-60,
		-50,
		-50,
		-120,
		-74,
		-60,
		-120
	],
	WAdieresis: [
		-60,
		-60,
		-50,
		-50,
		-120,
		-74,
		-60,
		-120
	],
	WAgrave: [
		-60,
		-60,
		-50,
		-50,
		-120,
		-74,
		-60,
		-120
	],
	WAmacron: [
		-60,
		-60,
		-50,
		-50,
		-120,
		-74,
		-60,
		-120
	],
	WAogonek: [
		-60,
		-60,
		-50,
		-50,
		-120,
		-74,
		-60,
		-120
	],
	WAring: [
		-60,
		-60,
		-50,
		-50,
		-120,
		-74,
		-60,
		-120
	],
	WAtilde: [
		-60,
		-60,
		-50,
		-50,
		-120,
		-74,
		-60,
		-120
	],
	WO: [
		-20,
		-20,
		-20,
		-20,
		-10,
		-15,
		-25,
		-10
	],
	WOacute: [
		-20,
		-20,
		-20,
		-20,
		-10,
		-15,
		-25,
		-10
	],
	WOcircumflex: [
		-20,
		-20,
		-20,
		-20,
		-10,
		-15,
		-25,
		-10
	],
	WOdieresis: [
		-20,
		-20,
		-20,
		-20,
		-10,
		-15,
		-25,
		-10
	],
	WOgrave: [
		-20,
		-20,
		-20,
		-20,
		-10,
		-15,
		-25,
		-10
	],
	WOhungarumlaut: [
		-20,
		-20,
		-20,
		-20,
		-10,
		-15,
		-25,
		-10
	],
	WOmacron: [
		-20,
		-20,
		-20,
		-20,
		-10,
		-15,
		-25,
		-10
	],
	WOslash: [
		-20,
		-20,
		-20,
		-20,
		-10,
		-15,
		-25,
		-10
	],
	WOtilde: [
		-20,
		-20,
		-20,
		-20,
		-10,
		-15,
		-25,
		-10
	],
	Wa: [
		-40,
		-40,
		-40,
		-40,
		-65,
		-85,
		-92,
		-80
	],
	Waacute: [
		-40,
		-40,
		-40,
		-40,
		-65,
		-85,
		-92,
		-80
	],
	Wabreve: [
		-40,
		-40,
		-40,
		-40,
		-65,
		-85,
		-92,
		-80
	],
	Wacircumflex: [
		-40,
		-40,
		-40,
		-40,
		-65,
		-85,
		-92,
		-80
	],
	Wadieresis: [
		-40,
		-40,
		-40,
		-40,
		-65,
		-85,
		-92,
		-80
	],
	Wagrave: [
		-40,
		-40,
		-40,
		-40,
		-65,
		-85,
		-92,
		-80
	],
	Wamacron: [
		-40,
		-40,
		-40,
		-40,
		-65,
		-85,
		-92,
		-80
	],
	Waogonek: [
		-40,
		-40,
		-40,
		-40,
		-65,
		-85,
		-92,
		-80
	],
	Waring: [
		-40,
		-40,
		-40,
		-40,
		-65,
		-85,
		-92,
		-80
	],
	Watilde: [
		-40,
		-40,
		-40,
		-40,
		-65,
		-85,
		-92,
		-80
	],
	Wcolon: [
		-10,
		-10,
		0,
		0,
		-55,
		-55,
		-65,
		-37
	],
	Wcomma: [
		-80,
		-80,
		-80,
		-80,
		-92,
		-74,
		-92,
		-92
	],
	We: [
		-35,
		-35,
		-30,
		-30,
		-65,
		-90,
		-92,
		-80
	],
	Weacute: [
		-35,
		-35,
		-30,
		-30,
		-65,
		-90,
		-92,
		-80
	],
	Wecaron: [
		-35,
		-35,
		-30,
		-30,
		-65,
		-90,
		-92,
		-80
	],
	Wecircumflex: [
		-35,
		-35,
		-30,
		-30,
		-65,
		-90,
		-92,
		-80
	],
	Wedieresis: [
		-35,
		-35,
		-30,
		-30,
		-65,
		-50,
		-52,
		-40
	],
	Wedotaccent: [
		-35,
		-35,
		-30,
		-30,
		-65,
		-90,
		-92,
		-80
	],
	Wegrave: [
		-35,
		-35,
		-30,
		-30,
		-65,
		-50,
		-52,
		-40
	],
	Wemacron: [
		-35,
		-35,
		-30,
		-30,
		-65,
		-50,
		-52,
		-40
	],
	Weogonek: [
		-35,
		-35,
		-30,
		-30,
		-65,
		-90,
		-92,
		-80
	],
	Whyphen: [
		-40,
		-40,
		-40,
		-40,
		-37,
		-50,
		-37,
		-65
	],
	Wo: [
		-60,
		-60,
		-30,
		-30,
		-75,
		-80,
		-92,
		-80
	],
	Woacute: [
		-60,
		-60,
		-30,
		-30,
		-75,
		-80,
		-92,
		-80
	],
	Wocircumflex: [
		-60,
		-60,
		-30,
		-30,
		-75,
		-80,
		-92,
		-80
	],
	Wodieresis: [
		-60,
		-60,
		-30,
		-30,
		-75,
		-80,
		-92,
		-80
	],
	Wograve: [
		-60,
		-60,
		-30,
		-30,
		-75,
		-80,
		-92,
		-80
	],
	Wohungarumlaut: [
		-60,
		-60,
		-30,
		-30,
		-75,
		-80,
		-92,
		-80
	],
	Womacron: [
		-60,
		-60,
		-30,
		-30,
		-75,
		-80,
		-92,
		-80
	],
	Woslash: [
		-60,
		-60,
		-30,
		-30,
		-75,
		-80,
		-92,
		-80
	],
	Wotilde: [
		-60,
		-60,
		-30,
		-30,
		-75,
		-80,
		-92,
		-80
	],
	Wperiod: [
		-80,
		-80,
		-80,
		-80,
		-92,
		-74,
		-92,
		-92
	],
	Wsemicolon: [
		-10,
		-10,
		0,
		0,
		-55,
		-55,
		-65,
		-37
	],
	Wu: [
		-45,
		-45,
		-30,
		-30,
		-50,
		-55,
		-55,
		-50
	],
	Wuacute: [
		-45,
		-45,
		-30,
		-30,
		-50,
		-55,
		-55,
		-50
	],
	Wucircumflex: [
		-45,
		-45,
		-30,
		-30,
		-50,
		-55,
		-55,
		-50
	],
	Wudieresis: [
		-45,
		-45,
		-30,
		-30,
		-50,
		-55,
		-55,
		-50
	],
	Wugrave: [
		-45,
		-45,
		-30,
		-30,
		-50,
		-55,
		-55,
		-50
	],
	Wuhungarumlaut: [
		-45,
		-45,
		-30,
		-30,
		-50,
		-55,
		-55,
		-50
	],
	Wumacron: [
		-45,
		-45,
		-30,
		-30,
		-50,
		-55,
		-55,
		-50
	],
	Wuogonek: [
		-45,
		-45,
		-30,
		-30,
		-50,
		-55,
		-55,
		-50
	],
	Wuring: [
		-45,
		-45,
		-30,
		-30,
		-50,
		-55,
		-55,
		-50
	],
	Wy: [
		-20,
		-20,
		-20,
		-20,
		-60,
		-55,
		-70,
		-73
	],
	Wyacute: [
		-20,
		-20,
		-20,
		-20,
		-60,
		-55,
		-70,
		-73
	],
	Wydieresis: [
		-20,
		-20,
		-20,
		-20,
		-60,
		-55,
		-70,
		-73
	],
	YA: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YAacute: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YAbreve: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YAcircumflex: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YAdieresis: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YAgrave: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YAmacron: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YAogonek: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YAring: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YAtilde: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YO: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YOacute: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YOcircumflex: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YOdieresis: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YOgrave: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YOhungarumlaut: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YOmacron: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YOslash: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YOtilde: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	Ya: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Yaacute: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Yabreve: [
		-90,
		-90,
		-70,
		-70,
		-85,
		-92,
		-92,
		-100
	],
	Yacircumflex: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Yadieresis: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-60
	],
	Yagrave: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-60
	],
	Yamacron: [
		-90,
		-90,
		-70,
		-70,
		-85,
		-92,
		-92,
		-60
	],
	Yaogonek: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Yaring: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Yatilde: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-60
	],
	Ycolon: [
		-50,
		-50,
		-60,
		-60,
		-92,
		-92,
		-65,
		-92
	],
	Ycomma: [
		-100,
		-100,
		-140,
		-140,
		-92,
		-92,
		-92,
		-129
	],
	Ye: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Yeacute: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Yecaron: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Yecircumflex: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-71,
		-92,
		-100
	],
	Yedieresis: [
		-80,
		-80,
		-140,
		-140,
		-71,
		-71,
		-52,
		-60
	],
	Yedotaccent: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Yegrave: [
		-80,
		-80,
		-140,
		-140,
		-71,
		-71,
		-52,
		-60
	],
	Yemacron: [
		-80,
		-80,
		-70,
		-70,
		-71,
		-71,
		-52,
		-60
	],
	Yeogonek: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Yo: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Yoacute: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Yocircumflex: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Yodieresis: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-70
	],
	Yograve: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-70
	],
	Yohungarumlaut: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Yomacron: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-70
	],
	Yoslash: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Yotilde: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-70
	],
	Yperiod: [
		-100,
		-100,
		-140,
		-140,
		-92,
		-74,
		-92,
		-129
	],
	Ysemicolon: [
		-50,
		-50,
		-60,
		-60,
		-92,
		-92,
		-65,
		-92
	],
	Yu: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Yuacute: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Yucircumflex: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Yudieresis: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-71
	],
	Yugrave: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-71
	],
	Yuhungarumlaut: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Yumacron: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-71
	],
	Yuogonek: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Yuring: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	YacuteA: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YacuteAacute: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YacuteAbreve: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YacuteAcircumflex: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YacuteAdieresis: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YacuteAgrave: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YacuteAmacron: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YacuteAogonek: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YacuteAring: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YacuteAtilde: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YacuteO: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YacuteOacute: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YacuteOcircumflex: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YacuteOdieresis: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YacuteOgrave: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YacuteOhungarumlaut: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YacuteOmacron: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YacuteOslash: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YacuteOtilde: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	Yacutea: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Yacuteaacute: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Yacuteabreve: [
		-90,
		-90,
		-70,
		-70,
		-85,
		-92,
		-92,
		-100
	],
	Yacuteacircumflex: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Yacuteadieresis: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-60
	],
	Yacuteagrave: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-60
	],
	Yacuteamacron: [
		-90,
		-90,
		-70,
		-70,
		-85,
		-92,
		-92,
		-60
	],
	Yacuteaogonek: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Yacutearing: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Yacuteatilde: [
		-90,
		-90,
		-70,
		-70,
		-85,
		-92,
		-92,
		-60
	],
	Yacutecolon: [
		-50,
		-50,
		-60,
		-60,
		-92,
		-92,
		-65,
		-92
	],
	Yacutecomma: [
		-100,
		-100,
		-140,
		-140,
		-92,
		-92,
		-92,
		-129
	],
	Yacutee: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Yacuteeacute: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Yacuteecaron: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Yacuteecircumflex: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-71,
		-92,
		-100
	],
	Yacuteedieresis: [
		-80,
		-80,
		-140,
		-140,
		-71,
		-71,
		-52,
		-60
	],
	Yacuteedotaccent: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Yacuteegrave: [
		-80,
		-80,
		-140,
		-140,
		-71,
		-71,
		-52,
		-60
	],
	Yacuteemacron: [
		-80,
		-80,
		-70,
		-70,
		-71,
		-71,
		-52,
		-60
	],
	Yacuteeogonek: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Yacuteo: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Yacuteoacute: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Yacuteocircumflex: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Yacuteodieresis: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-70
	],
	Yacuteograve: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-70
	],
	Yacuteohungarumlaut: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Yacuteomacron: [
		-100,
		-100,
		-70,
		-70,
		-111,
		-111,
		-92,
		-70
	],
	Yacuteoslash: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Yacuteotilde: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-70
	],
	Yacuteperiod: [
		-100,
		-100,
		-140,
		-140,
		-92,
		-74,
		-92,
		-129
	],
	Yacutesemicolon: [
		-50,
		-50,
		-60,
		-60,
		-92,
		-92,
		-65,
		-92
	],
	Yacuteu: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Yacuteuacute: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Yacuteucircumflex: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Yacuteudieresis: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-71
	],
	Yacuteugrave: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-71
	],
	Yacuteuhungarumlaut: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Yacuteumacron: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-71
	],
	Yacuteuogonek: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Yacuteuring: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	YdieresisA: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YdieresisAacute: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YdieresisAbreve: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YdieresisAcircumflex: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YdieresisAdieresis: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YdieresisAgrave: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YdieresisAmacron: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YdieresisAogonek: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YdieresisAring: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YdieresisAtilde: [
		-110,
		-110,
		-110,
		-110,
		-110,
		-74,
		-50,
		-120
	],
	YdieresisO: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YdieresisOacute: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YdieresisOcircumflex: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YdieresisOdieresis: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YdieresisOgrave: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YdieresisOhungarumlaut: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YdieresisOmacron: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YdieresisOslash: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	YdieresisOtilde: [
		-70,
		-70,
		-85,
		-85,
		-35,
		-25,
		-15,
		-30
	],
	Ydieresisa: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Ydieresisaacute: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Ydieresisabreve: [
		-90,
		-90,
		-70,
		-70,
		-85,
		-92,
		-92,
		-100
	],
	Ydieresisacircumflex: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Ydieresisadieresis: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-60
	],
	Ydieresisagrave: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-60
	],
	Ydieresisamacron: [
		-90,
		-90,
		-70,
		-70,
		-85,
		-92,
		-92,
		-60
	],
	Ydieresisaogonek: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Ydieresisaring: [
		-90,
		-90,
		-140,
		-140,
		-85,
		-92,
		-92,
		-100
	],
	Ydieresisatilde: [
		-90,
		-90,
		-70,
		-70,
		-85,
		-92,
		-92,
		-100
	],
	Ydieresiscolon: [
		-50,
		-50,
		-60,
		-60,
		-92,
		-92,
		-65,
		-92
	],
	Ydieresiscomma: [
		-100,
		-100,
		-140,
		-140,
		-92,
		-92,
		-92,
		-129
	],
	Ydieresise: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Ydieresiseacute: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Ydieresisecaron: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Ydieresisecircumflex: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-71,
		-92,
		-100
	],
	Ydieresisedieresis: [
		-80,
		-80,
		-140,
		-140,
		-71,
		-71,
		-52,
		-60
	],
	Ydieresisedotaccent: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Ydieresisegrave: [
		-80,
		-80,
		-140,
		-140,
		-71,
		-71,
		-52,
		-60
	],
	Ydieresisemacron: [
		-80,
		-80,
		-70,
		-70,
		-71,
		-71,
		-52,
		-60
	],
	Ydieresiseogonek: [
		-80,
		-80,
		-140,
		-140,
		-111,
		-111,
		-92,
		-100
	],
	Ydieresiso: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Ydieresisoacute: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Ydieresisocircumflex: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Ydieresisodieresis: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-70
	],
	Ydieresisograve: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-70
	],
	Ydieresisohungarumlaut: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Ydieresisomacron: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-70
	],
	Ydieresisoslash: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-110
	],
	Ydieresisotilde: [
		-100,
		-100,
		-140,
		-140,
		-111,
		-111,
		-92,
		-70
	],
	Ydieresisperiod: [
		-100,
		-100,
		-140,
		-140,
		-92,
		-74,
		-92,
		-129
	],
	Ydieresissemicolon: [
		-50,
		-50,
		-60,
		-60,
		-92,
		-92,
		-65,
		-92
	],
	Ydieresisu: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Ydieresisuacute: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Ydieresisucircumflex: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Ydieresisudieresis: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-71
	],
	Ydieresisugrave: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-71
	],
	Ydieresisuhungarumlaut: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Ydieresisumacron: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-71
	],
	Ydieresisuogonek: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	Ydieresisuring: [
		-100,
		-100,
		-110,
		-110,
		-92,
		-92,
		-92,
		-111
	],
	ag: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	agbreve: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	agcommaaccent: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	av: [
		-15,
		-15,
		-20,
		-20,
		-25,
		0,
		0,
		-20
	],
	aw: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		0,
		-15
	],
	ay: [
		-20,
		-20,
		-30,
		-30
	],
	ayacute: [
		-20,
		-20,
		-30,
		-30
	],
	aydieresis: [
		-20,
		-20,
		-30,
		-30
	],
	aacuteg: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	aacutegbreve: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	aacutegcommaaccent: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	aacutev: [
		-15,
		-15,
		-20,
		-20,
		-25,
		0,
		0,
		-20
	],
	aacutew: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		0,
		-15
	],
	aacutey: [
		-20,
		-20,
		-30,
		-30
	],
	aacuteyacute: [
		-20,
		-20,
		-30,
		-30
	],
	aacuteydieresis: [
		-20,
		-20,
		-30,
		-30
	],
	abreveg: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	abrevegbreve: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	abrevegcommaaccent: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	abrevev: [
		-15,
		-15,
		-20,
		-20,
		-25,
		0,
		0,
		-20
	],
	abrevew: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		0,
		-15
	],
	abrevey: [
		-20,
		-20,
		-30,
		-30
	],
	abreveyacute: [
		-20,
		-20,
		-30,
		-30
	],
	abreveydieresis: [
		-20,
		-20,
		-30,
		-30
	],
	acircumflexg: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	acircumflexgbreve: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	acircumflexgcommaaccent: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	acircumflexv: [
		-15,
		-15,
		-20,
		-20,
		-25,
		0,
		0,
		-20
	],
	acircumflexw: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		0,
		-15
	],
	acircumflexy: [
		-20,
		-20,
		-30,
		-30
	],
	acircumflexyacute: [
		-20,
		-20,
		-30,
		-30
	],
	acircumflexydieresis: [
		-20,
		-20,
		-30,
		-30
	],
	adieresisg: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	adieresisgbreve: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	adieresisgcommaaccent: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	adieresisv: [
		-15,
		-15,
		-20,
		-20,
		-25,
		0,
		0,
		-20
	],
	adieresisw: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		0,
		-15
	],
	adieresisy: [
		-20,
		-20,
		-30,
		-30
	],
	adieresisyacute: [
		-20,
		-20,
		-30,
		-30
	],
	adieresisydieresis: [
		-20,
		-20,
		-30,
		-30
	],
	agraveg: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	agravegbreve: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	agravegcommaaccent: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	agravev: [
		-15,
		-15,
		-20,
		-20,
		-25,
		0,
		0,
		-20
	],
	agravew: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		0,
		-15
	],
	agravey: [
		-20,
		-20,
		-30,
		-30
	],
	agraveyacute: [
		-20,
		-20,
		-30,
		-30
	],
	agraveydieresis: [
		-20,
		-20,
		-30,
		-30
	],
	amacrong: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	amacrongbreve: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	amacrongcommaaccent: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	amacronv: [
		-15,
		-15,
		-20,
		-20,
		-25,
		0,
		0,
		-20
	],
	amacronw: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		0,
		-15
	],
	amacrony: [
		-20,
		-20,
		-30,
		-30
	],
	amacronyacute: [
		-20,
		-20,
		-30,
		-30
	],
	amacronydieresis: [
		-20,
		-20,
		-30,
		-30
	],
	aogonekg: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	aogonekgbreve: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	aogonekgcommaaccent: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	aogonekv: [
		-15,
		-15,
		-20,
		-20,
		-25,
		0,
		0,
		-20
	],
	aogonekw: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		0,
		-15
	],
	aogoneky: [
		-20,
		-20,
		-30,
		-30
	],
	aogonekyacute: [
		-20,
		-20,
		-30,
		-30
	],
	aogonekydieresis: [
		-20,
		-20,
		-30,
		-30
	],
	aringg: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	aringgbreve: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	aringgcommaaccent: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	aringv: [
		-15,
		-15,
		-20,
		-20,
		-25,
		0,
		0,
		-20
	],
	aringw: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		0,
		-15
	],
	aringy: [
		-20,
		-20,
		-30,
		-30
	],
	aringyacute: [
		-20,
		-20,
		-30,
		-30
	],
	aringydieresis: [
		-20,
		-20,
		-30,
		-30
	],
	atildeg: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	atildegbreve: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	atildegcommaaccent: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	atildev: [
		-15,
		-15,
		-20,
		-20,
		-25,
		0,
		0,
		-20
	],
	atildew: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		0,
		-15
	],
	atildey: [
		-20,
		-20,
		-30,
		-30
	],
	atildeyacute: [
		-20,
		-20,
		-30,
		-30
	],
	atildeydieresis: [
		-20,
		-20,
		-30,
		-30
	],
	bl: [
		-10,
		-10,
		-20,
		-20
	],
	blacute: [
		-10,
		-10,
		-20,
		-20
	],
	blcommaaccent: [
		-10,
		-10,
		-20,
		-20
	],
	blslash: [
		-10,
		-10,
		-20,
		-20
	],
	bu: [
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20
	],
	buacute: [
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20
	],
	bucircumflex: [
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20
	],
	budieresis: [
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20
	],
	bugrave: [
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20
	],
	buhungarumlaut: [
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20
	],
	bumacron: [
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20
	],
	buogonek: [
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20
	],
	buring: [
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20,
		-20
	],
	bv: [
		-20,
		-20,
		-20,
		-20,
		-15,
		0,
		0,
		-15
	],
	by: [
		-20,
		-20,
		-20,
		-20
	],
	byacute: [
		-20,
		-20,
		-20,
		-20
	],
	bydieresis: [
		-20,
		-20,
		-20,
		-20
	],
	ch: [
		-10,
		-10,
		0,
		0,
		0,
		-10,
		-15
	],
	ck: [
		-20,
		-20,
		-20,
		-20,
		0,
		-10,
		-20
	],
	ckcommaaccent: [
		-20,
		-20,
		-20,
		-20,
		0,
		-10,
		-20
	],
	cl: [
		-20,
		-20
	],
	clacute: [
		-20,
		-20
	],
	clcommaaccent: [
		-20,
		-20
	],
	clslash: [
		-20,
		-20
	],
	cy: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		0,
		-15
	],
	cyacute: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		0,
		-15
	],
	cydieresis: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		0,
		-15
	],
	cacuteh: [
		-10,
		-10,
		0,
		0,
		0,
		-10,
		-15
	],
	cacutek: [
		-20,
		-20,
		-20,
		-20,
		0,
		-10,
		-20
	],
	cacutekcommaaccent: [
		-20,
		-20,
		-20,
		-20,
		0,
		-10,
		-20
	],
	cacutel: [
		-20,
		-20
	],
	cacutelacute: [
		-20,
		-20
	],
	cacutelcommaaccent: [
		-20,
		-20
	],
	cacutelslash: [
		-20,
		-20
	],
	cacutey: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		0,
		-15
	],
	cacuteyacute: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		0,
		-15
	],
	cacuteydieresis: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		0,
		-15
	],
	ccaronh: [
		-10,
		-10,
		0,
		0,
		0,
		-10,
		-15
	],
	ccaronk: [
		-20,
		-20,
		-20,
		-20,
		0,
		-10,
		-20
	],
	ccaronkcommaaccent: [
		-20,
		-20,
		-20,
		-20,
		0,
		-10,
		-20
	],
	ccaronl: [
		-20,
		-20
	],
	ccaronlacute: [
		-20,
		-20
	],
	ccaronlcommaaccent: [
		-20,
		-20
	],
	ccaronlslash: [
		-20,
		-20
	],
	ccarony: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		0,
		-15
	],
	ccaronyacute: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		0,
		-15
	],
	ccaronydieresis: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		0,
		-15
	],
	ccedillah: [
		-10,
		-10,
		0,
		0,
		0,
		-10,
		-15
	],
	ccedillak: [
		-20,
		-20,
		-20,
		-20,
		0,
		-10,
		-20
	],
	ccedillakcommaaccent: [
		-20,
		-20,
		-20,
		-20,
		0,
		-10,
		-20
	],
	ccedillal: [
		-20,
		-20
	],
	ccedillalacute: [
		-20,
		-20
	],
	ccedillalcommaaccent: [
		-20,
		-20
	],
	ccedillalslash: [
		-20,
		-20
	],
	ccedillay: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		0,
		-15
	],
	ccedillayacute: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		0,
		-15
	],
	ccedillaydieresis: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		0,
		-15
	],
	colonspace: [
		-40,
		-40,
		-50,
		-50
	],
	commaquotedblright: [
		-120,
		-120,
		-100,
		-100,
		-45,
		-95,
		-140,
		-70
	],
	commaquoteright: [
		-120,
		-120,
		-100,
		-100,
		-55,
		-95,
		-140,
		-70
	],
	commaspace: [
		-40,
		-40
	],
	dd: [
		-10,
		-10
	],
	ddcroat: [
		-10,
		-10
	],
	dv: [
		-15,
		-15
	],
	dw: [
		-15,
		-15,
		0,
		0,
		-15
	],
	dy: [
		-15,
		-15
	],
	dyacute: [
		-15,
		-15
	],
	dydieresis: [
		-15,
		-15
	],
	dcroatd: [
		-10,
		-10
	],
	dcroatdcroat: [
		-10,
		-10
	],
	dcroatv: [
		-15,
		-15
	],
	dcroatw: [
		-15,
		-15,
		0,
		0,
		-15
	],
	dcroaty: [
		-15,
		-15
	],
	dcroatyacute: [
		-15,
		-15
	],
	dcroatydieresis: [
		-15,
		-15
	],
	ecomma: [
		10,
		10,
		-15,
		-15,
		0,
		0,
		-10
	],
	eperiod: [
		20,
		20,
		-15,
		-15,
		0,
		0,
		-15
	],
	ev: [
		-15,
		-15,
		-30,
		-30,
		-15,
		0,
		-15,
		-25
	],
	ew: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-15,
		-25
	],
	ex: [
		-15,
		-15,
		-30,
		-30,
		0,
		0,
		-20,
		-15
	],
	ey: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	eyacute: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	eydieresis: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	eacutecomma: [
		10,
		10,
		-15,
		-15,
		0,
		0,
		-10
	],
	eacuteperiod: [
		20,
		20,
		-15,
		-15,
		0,
		0,
		-15
	],
	eacutev: [
		-15,
		-15,
		-30,
		-30,
		-15,
		0,
		-15,
		-25
	],
	eacutew: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-15,
		-25
	],
	eacutex: [
		-15,
		-15,
		-30,
		-30,
		0,
		0,
		-20,
		-15
	],
	eacutey: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	eacuteyacute: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	eacuteydieresis: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	ecaroncomma: [
		10,
		10,
		-15,
		-15,
		0,
		0,
		-10
	],
	ecaronperiod: [
		20,
		20,
		-15,
		-15,
		0,
		0,
		-15
	],
	ecaronv: [
		-15,
		-15,
		-30,
		-30,
		-15,
		0,
		-15,
		-25
	],
	ecaronw: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-15,
		-25
	],
	ecaronx: [
		-15,
		-15,
		-30,
		-30,
		0,
		0,
		-20,
		-15
	],
	ecarony: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	ecaronyacute: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	ecaronydieresis: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	ecircumflexcomma: [
		10,
		10,
		-15,
		-15,
		0,
		0,
		-10
	],
	ecircumflexperiod: [
		20,
		20,
		-15,
		-15,
		0,
		0,
		-15
	],
	ecircumflexv: [
		-15,
		-15,
		-30,
		-30,
		-15,
		0,
		-15,
		-25
	],
	ecircumflexw: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-15,
		-25
	],
	ecircumflexx: [
		-15,
		-15,
		-30,
		-30,
		0,
		0,
		-20,
		-15
	],
	ecircumflexy: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	ecircumflexyacute: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	ecircumflexydieresis: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	edieresiscomma: [
		10,
		10,
		-15,
		-15,
		0,
		0,
		-10
	],
	edieresisperiod: [
		20,
		20,
		-15,
		-15,
		0,
		0,
		-15
	],
	edieresisv: [
		-15,
		-15,
		-30,
		-30,
		-15,
		0,
		-15,
		-25
	],
	edieresisw: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-15,
		-25
	],
	edieresisx: [
		-15,
		-15,
		-30,
		-30,
		0,
		0,
		-20,
		-15
	],
	edieresisy: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	edieresisyacute: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	edieresisydieresis: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	edotaccentcomma: [
		10,
		10,
		-15,
		-15,
		0,
		0,
		-10
	],
	edotaccentperiod: [
		20,
		20,
		-15,
		-15,
		0,
		0,
		-15
	],
	edotaccentv: [
		-15,
		-15,
		-30,
		-30,
		-15,
		0,
		-15,
		-25
	],
	edotaccentw: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-15,
		-25
	],
	edotaccentx: [
		-15,
		-15,
		-30,
		-30,
		0,
		0,
		-20,
		-15
	],
	edotaccenty: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	edotaccentyacute: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	edotaccentydieresis: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	egravecomma: [
		10,
		10,
		-15,
		-15,
		0,
		0,
		-10
	],
	egraveperiod: [
		20,
		20,
		-15,
		-15,
		0,
		0,
		-15
	],
	egravev: [
		-15,
		-15,
		-30,
		-30,
		-15,
		0,
		-15,
		-25
	],
	egravew: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-15,
		-25
	],
	egravex: [
		-15,
		-15,
		-30,
		-30,
		0,
		0,
		-20,
		-15
	],
	egravey: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	egraveyacute: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	egraveydieresis: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	emacroncomma: [
		10,
		10,
		-15,
		-15,
		0,
		0,
		-10
	],
	emacronperiod: [
		20,
		20,
		-15,
		-15,
		0,
		0,
		-15
	],
	emacronv: [
		-15,
		-15,
		-30,
		-30,
		-15,
		0,
		-15,
		-25
	],
	emacronw: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-15,
		-25
	],
	emacronx: [
		-15,
		-15,
		-30,
		-30,
		0,
		0,
		-20,
		-15
	],
	emacrony: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	emacronyacute: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	emacronydieresis: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	eogonekcomma: [
		10,
		10,
		-15,
		-15,
		0,
		0,
		-10
	],
	eogonekperiod: [
		20,
		20,
		-15,
		-15,
		0,
		0,
		-15
	],
	eogonekv: [
		-15,
		-15,
		-30,
		-30,
		-15,
		0,
		-15,
		-25
	],
	eogonekw: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-15,
		-25
	],
	eogonekx: [
		-15,
		-15,
		-30,
		-30,
		0,
		0,
		-20,
		-15
	],
	eogoneky: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	eogonekyacute: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	eogonekydieresis: [
		-15,
		-15,
		-20,
		-20,
		0,
		0,
		-30,
		-15
	],
	fcomma: [
		-10,
		-10,
		-30,
		-30,
		-15,
		-10,
		-10
	],
	fe: [
		-10,
		-10,
		-30,
		-30,
		0,
		-10
	],
	feacute: [
		-10,
		-10,
		-30,
		-30,
		0,
		-10
	],
	fecaron: [
		-10,
		-10,
		-30,
		-30
	],
	fecircumflex: [
		-10,
		-10,
		-30,
		-30
	],
	fedieresis: [
		-10,
		-10,
		-30,
		-30
	],
	fedotaccent: [
		-10,
		-10,
		-30,
		-30,
		0,
		-10
	],
	fegrave: [
		-10,
		-10,
		-30,
		-30
	],
	femacron: [
		-10,
		-10,
		-30,
		-30
	],
	feogonek: [
		-10,
		-10,
		-30,
		-30,
		0,
		-10
	],
	fo: [
		-20,
		-20,
		-30,
		-30,
		-25,
		-10
	],
	foacute: [
		-20,
		-20,
		-30,
		-30,
		-25,
		-10
	],
	focircumflex: [
		-20,
		-20,
		-30,
		-30,
		-25,
		-10
	],
	fodieresis: [
		-20,
		-20,
		-30,
		-30,
		-25
	],
	fograve: [
		-20,
		-20,
		-30,
		-30,
		-25,
		-10
	],
	fohungarumlaut: [
		-20,
		-20,
		-30,
		-30,
		-25,
		-10
	],
	fomacron: [
		-20,
		-20,
		-30,
		-30,
		-25
	],
	foslash: [
		-20,
		-20,
		-30,
		-30,
		-25,
		-10
	],
	fotilde: [
		-20,
		-20,
		-30,
		-30,
		-25,
		-10
	],
	fperiod: [
		-10,
		-10,
		-30,
		-30,
		-15,
		-10,
		-15
	],
	fquotedblright: [
		30,
		30,
		60,
		60,
		50
	],
	fquoteright: [
		30,
		30,
		50,
		50,
		55,
		55,
		92,
		55
	],
	ge: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	geacute: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gecaron: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gecircumflex: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gedieresis: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gedotaccent: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gegrave: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gemacron: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	geogonek: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gg: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	ggbreve: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	ggcommaaccent: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	gbrevee: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gbreveeacute: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gbreveecaron: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gbreveecircumflex: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gbreveedieresis: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gbreveedotaccent: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gbreveegrave: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gbreveemacron: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gbreveeogonek: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gbreveg: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	gbrevegbreve: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	gbrevegcommaaccent: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	gcommaaccente: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gcommaaccenteacute: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gcommaaccentecaron: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gcommaaccentecircumflex: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gcommaaccentedieresis: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gcommaaccentedotaccent: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gcommaaccentegrave: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gcommaaccentemacron: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gcommaaccenteogonek: [
		10,
		10,
		0,
		0,
		0,
		0,
		-10
	],
	gcommaaccentg: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	gcommaaccentgbreve: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	gcommaaccentgcommaaccent: [
		-10,
		-10,
		0,
		0,
		0,
		0,
		-10
	],
	hy: [
		-20,
		-20,
		-30,
		-30,
		-15,
		0,
		0,
		-5
	],
	hyacute: [
		-20,
		-20,
		-30,
		-30,
		-15,
		0,
		0,
		-5
	],
	hydieresis: [
		-20,
		-20,
		-30,
		-30,
		-15,
		0,
		0,
		-5
	],
	ko: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	koacute: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kocircumflex: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kodieresis: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kograve: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kohungarumlaut: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	komacron: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	koslash: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kotilde: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kcommaaccento: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kcommaaccentoacute: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kcommaaccentocircumflex: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kcommaaccentodieresis: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kcommaaccentograve: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kcommaaccentohungarumlaut: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kcommaaccentomacron: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kcommaaccentoslash: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	kcommaaccentotilde: [
		-15,
		-15,
		-20,
		-20,
		-15,
		-10,
		-10,
		-10
	],
	lw: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ly: [
		-15,
		-15
	],
	lyacute: [
		-15,
		-15
	],
	lydieresis: [
		-15,
		-15
	],
	lacutew: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	lacutey: [
		-15,
		-15
	],
	lacuteyacute: [
		-15,
		-15
	],
	lacuteydieresis: [
		-15,
		-15
	],
	lcommaaccentw: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	lcommaaccenty: [
		-15,
		-15
	],
	lcommaaccentyacute: [
		-15,
		-15
	],
	lcommaaccentydieresis: [
		-15,
		-15
	],
	lslashw: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	lslashy: [
		-15,
		-15
	],
	lslashyacute: [
		-15,
		-15
	],
	lslashydieresis: [
		-15,
		-15
	],
	mu: [
		-20,
		-20,
		-10,
		-10
	],
	muacute: [
		-20,
		-20,
		-10,
		-10
	],
	mucircumflex: [
		-20,
		-20,
		-10,
		-10
	],
	mudieresis: [
		-20,
		-20,
		-10,
		-10
	],
	mugrave: [
		-20,
		-20,
		-10,
		-10
	],
	muhungarumlaut: [
		-20,
		-20,
		-10,
		-10
	],
	mumacron: [
		-20,
		-20,
		-10,
		-10
	],
	muogonek: [
		-20,
		-20,
		-10,
		-10
	],
	muring: [
		-20,
		-20,
		-10,
		-10
	],
	my: [
		-30,
		-30,
		-15,
		-15
	],
	myacute: [
		-30,
		-30,
		-15,
		-15
	],
	mydieresis: [
		-30,
		-30,
		-15,
		-15
	],
	nu: [
		-10,
		-10,
		-10,
		-10
	],
	nuacute: [
		-10,
		-10,
		-10,
		-10
	],
	nucircumflex: [
		-10,
		-10,
		-10,
		-10
	],
	nudieresis: [
		-10,
		-10,
		-10,
		-10
	],
	nugrave: [
		-10,
		-10,
		-10,
		-10
	],
	nuhungarumlaut: [
		-10,
		-10,
		-10,
		-10
	],
	numacron: [
		-10,
		-10,
		-10,
		-10
	],
	nuogonek: [
		-10,
		-10,
		-10,
		-10
	],
	nuring: [
		-10,
		-10,
		-10,
		-10
	],
	nv: [
		-40,
		-40,
		-20,
		-20,
		-40,
		-40,
		-40,
		-40
	],
	ny: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	nyacute: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	nydieresis: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	nacuteu: [
		-10,
		-10,
		-10,
		-10
	],
	nacuteuacute: [
		-10,
		-10,
		-10,
		-10
	],
	nacuteucircumflex: [
		-10,
		-10,
		-10,
		-10
	],
	nacuteudieresis: [
		-10,
		-10,
		-10,
		-10
	],
	nacuteugrave: [
		-10,
		-10,
		-10,
		-10
	],
	nacuteuhungarumlaut: [
		-10,
		-10,
		-10,
		-10
	],
	nacuteumacron: [
		-10,
		-10,
		-10,
		-10
	],
	nacuteuogonek: [
		-10,
		-10,
		-10,
		-10
	],
	nacuteuring: [
		-10,
		-10,
		-10,
		-10
	],
	nacutev: [
		-40,
		-40,
		-20,
		-20,
		-40,
		-40,
		-40,
		-40
	],
	nacutey: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	nacuteyacute: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	nacuteydieresis: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	ncaronu: [
		-10,
		-10,
		-10,
		-10
	],
	ncaronuacute: [
		-10,
		-10,
		-10,
		-10
	],
	ncaronucircumflex: [
		-10,
		-10,
		-10,
		-10
	],
	ncaronudieresis: [
		-10,
		-10,
		-10,
		-10
	],
	ncaronugrave: [
		-10,
		-10,
		-10,
		-10
	],
	ncaronuhungarumlaut: [
		-10,
		-10,
		-10,
		-10
	],
	ncaronumacron: [
		-10,
		-10,
		-10,
		-10
	],
	ncaronuogonek: [
		-10,
		-10,
		-10,
		-10
	],
	ncaronuring: [
		-10,
		-10,
		-10,
		-10
	],
	ncaronv: [
		-40,
		-40,
		-20,
		-20,
		-40,
		-40,
		-40,
		-40
	],
	ncarony: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	ncaronyacute: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	ncaronydieresis: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	ncommaaccentu: [
		-10,
		-10,
		-10,
		-10
	],
	ncommaaccentuacute: [
		-10,
		-10,
		-10,
		-10
	],
	ncommaaccentucircumflex: [
		-10,
		-10,
		-10,
		-10
	],
	ncommaaccentudieresis: [
		-10,
		-10,
		-10,
		-10
	],
	ncommaaccentugrave: [
		-10,
		-10,
		-10,
		-10
	],
	ncommaaccentuhungarumlaut: [
		-10,
		-10,
		-10,
		-10
	],
	ncommaaccentumacron: [
		-10,
		-10,
		-10,
		-10
	],
	ncommaaccentuogonek: [
		-10,
		-10,
		-10,
		-10
	],
	ncommaaccenturing: [
		-10,
		-10,
		-10,
		-10
	],
	ncommaaccentv: [
		-40,
		-40,
		-20,
		-20,
		-40,
		-40,
		-40,
		-40
	],
	ncommaaccenty: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	ncommaaccentyacute: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	ncommaaccentydieresis: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	ntildeu: [
		-10,
		-10,
		-10,
		-10
	],
	ntildeuacute: [
		-10,
		-10,
		-10,
		-10
	],
	ntildeucircumflex: [
		-10,
		-10,
		-10,
		-10
	],
	ntildeudieresis: [
		-10,
		-10,
		-10,
		-10
	],
	ntildeugrave: [
		-10,
		-10,
		-10,
		-10
	],
	ntildeuhungarumlaut: [
		-10,
		-10,
		-10,
		-10
	],
	ntildeumacron: [
		-10,
		-10,
		-10,
		-10
	],
	ntildeuogonek: [
		-10,
		-10,
		-10,
		-10
	],
	ntildeuring: [
		-10,
		-10,
		-10,
		-10
	],
	ntildev: [
		-40,
		-40,
		-20,
		-20,
		-40,
		-40,
		-40,
		-40
	],
	ntildey: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	ntildeyacute: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	ntildeydieresis: [
		-20,
		-20,
		-15,
		-15,
		0,
		0,
		0,
		-15
	],
	ov: [
		-20,
		-20,
		-15,
		-15,
		-10,
		-15,
		-10,
		-15
	],
	ow: [
		-15,
		-15,
		-15,
		-15,
		-10,
		-25,
		0,
		-25
	],
	ox: [
		-30,
		-30,
		-30,
		-30,
		0,
		-10
	],
	oy: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	oyacute: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	oydieresis: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	oacutev: [
		-20,
		-20,
		-15,
		-15,
		-10,
		-15,
		-10,
		-15
	],
	oacutew: [
		-15,
		-15,
		-15,
		-15,
		-10,
		-25,
		0,
		-25
	],
	oacutex: [
		-30,
		-30,
		-30,
		-30,
		0,
		-10
	],
	oacutey: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	oacuteyacute: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	oacuteydieresis: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	ocircumflexv: [
		-20,
		-20,
		-15,
		-15,
		-10,
		-15,
		-10,
		-15
	],
	ocircumflexw: [
		-15,
		-15,
		-15,
		-15,
		-10,
		-25,
		0,
		-25
	],
	ocircumflexx: [
		-30,
		-30,
		-30,
		-30,
		0,
		-10
	],
	ocircumflexy: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	ocircumflexyacute: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	ocircumflexydieresis: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	odieresisv: [
		-20,
		-20,
		-15,
		-15,
		-10,
		-15,
		-10,
		-15
	],
	odieresisw: [
		-15,
		-15,
		-15,
		-15,
		-10,
		-25,
		0,
		-25
	],
	odieresisx: [
		-30,
		-30,
		-30,
		-30,
		0,
		-10
	],
	odieresisy: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	odieresisyacute: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	odieresisydieresis: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	ogravev: [
		-20,
		-20,
		-15,
		-15,
		-10,
		-15,
		-10,
		-15
	],
	ogravew: [
		-15,
		-15,
		-15,
		-15,
		-10,
		-25,
		0,
		-25
	],
	ogravex: [
		-30,
		-30,
		-30,
		-30,
		0,
		-10
	],
	ogravey: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	ograveyacute: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	ograveydieresis: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	ohungarumlautv: [
		-20,
		-20,
		-15,
		-15,
		-10,
		-15,
		-10,
		-15
	],
	ohungarumlautw: [
		-15,
		-15,
		-15,
		-15,
		-10,
		-25,
		0,
		-25
	],
	ohungarumlautx: [
		-30,
		-30,
		-30,
		-30,
		0,
		-10
	],
	ohungarumlauty: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	ohungarumlautyacute: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	ohungarumlautydieresis: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	omacronv: [
		-20,
		-20,
		-15,
		-15,
		-10,
		-15,
		-10,
		-15
	],
	omacronw: [
		-15,
		-15,
		-15,
		-15,
		-10,
		-25,
		0,
		-25
	],
	omacronx: [
		-30,
		-30,
		-30,
		-30,
		0,
		-10
	],
	omacrony: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	omacronyacute: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	omacronydieresis: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	oslashv: [
		-20,
		-20,
		-70,
		-70,
		-10,
		-15,
		-10,
		-15
	],
	oslashw: [
		-15,
		-15,
		-70,
		-70,
		-10,
		-25,
		0,
		-25
	],
	oslashx: [
		-30,
		-30,
		-85,
		-85,
		0,
		-10
	],
	oslashy: [
		-20,
		-20,
		-70,
		-70,
		0,
		-10,
		0,
		-10
	],
	oslashyacute: [
		-20,
		-20,
		-70,
		-70,
		0,
		-10,
		0,
		-10
	],
	oslashydieresis: [
		-20,
		-20,
		-70,
		-70,
		0,
		-10,
		0,
		-10
	],
	otildev: [
		-20,
		-20,
		-15,
		-15,
		-10,
		-15,
		-10,
		-15
	],
	otildew: [
		-15,
		-15,
		-15,
		-15,
		-10,
		-25,
		0,
		-25
	],
	otildex: [
		-30,
		-30,
		-30,
		-30,
		0,
		-10
	],
	otildey: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	otildeyacute: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	otildeydieresis: [
		-20,
		-20,
		-30,
		-30,
		0,
		-10,
		0,
		-10
	],
	py: [
		-15,
		-15,
		-30,
		-30,
		0,
		0,
		0,
		-10
	],
	pyacute: [
		-15,
		-15,
		-30,
		-30,
		0,
		0,
		0,
		-10
	],
	pydieresis: [
		-15,
		-15,
		-30,
		-30,
		0,
		0,
		0,
		-10
	],
	periodquotedblright: [
		-120,
		-120,
		-100,
		-100,
		-55,
		-95,
		-140,
		-70
	],
	periodquoteright: [
		-120,
		-120,
		-100,
		-100,
		-55,
		-95,
		-140,
		-70
	],
	periodspace: [
		-40,
		-40,
		-60,
		-60
	],
	quotedblrightspace: [
		-80,
		-80,
		-40,
		-40
	],
	quoteleftquoteleft: [
		-46,
		-46,
		-57,
		-57,
		-63,
		-74,
		-111,
		-74
	],
	quoterightd: [
		-80,
		-80,
		-50,
		-50,
		-20,
		-15,
		-25,
		-50
	],
	quoterightdcroat: [
		-80,
		-80,
		-50,
		-50,
		-20,
		-15,
		-25,
		-50
	],
	quoterightl: [
		-20,
		-20,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	quoterightlacute: [
		-20,
		-20,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	quoterightlcommaaccent: [
		-20,
		-20,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	quoterightlslash: [
		-20,
		-20,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	quoterightquoteright: [
		-46,
		-46,
		-57,
		-57,
		-63,
		-74,
		-111,
		-74
	],
	quoterightr: [
		-40,
		-40,
		-50,
		-50,
		-20,
		-15,
		-25,
		-50
	],
	quoterightracute: [
		-40,
		-40,
		-50,
		-50,
		-20,
		-15,
		-25,
		-50
	],
	quoterightrcaron: [
		-40,
		-40,
		-50,
		-50,
		-20,
		-15,
		-25,
		-50
	],
	quoterightrcommaaccent: [
		-40,
		-40,
		-50,
		-50,
		-20,
		-15,
		-25,
		-50
	],
	quoterights: [
		-60,
		-60,
		-50,
		-50,
		-37,
		-74,
		-40,
		-55
	],
	quoterightsacute: [
		-60,
		-60,
		-50,
		-50,
		-37,
		-74,
		-40,
		-55
	],
	quoterightscaron: [
		-60,
		-60,
		-50,
		-50,
		-37,
		-74,
		-40,
		-55
	],
	quoterightscedilla: [
		-60,
		-60,
		-50,
		-50,
		-37,
		-74,
		-40,
		-55
	],
	quoterightscommaaccent: [
		-60,
		-60,
		-50,
		-50,
		-37,
		-74,
		-40,
		-55
	],
	quoterightspace: [
		-80,
		-80,
		-70,
		-70,
		-74,
		-74,
		-111,
		-74
	],
	quoterightv: [
		-20,
		-20,
		0,
		0,
		-20,
		-15,
		-10,
		-50
	],
	rc: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rcacute: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rccaron: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rccedilla: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rcomma: [
		-60,
		-60,
		-50,
		-50,
		-92,
		-65,
		-111,
		-40
	],
	rd: [
		-20,
		-20,
		0,
		0,
		0,
		0,
		-37
	],
	rdcroat: [
		-20,
		-20,
		0,
		0,
		0,
		0,
		-37
	],
	rg: [
		-15,
		-15,
		0,
		0,
		-10,
		0,
		-37,
		-18
	],
	rgbreve: [
		-15,
		-15,
		0,
		0,
		-10,
		0,
		-37,
		-18
	],
	rgcommaaccent: [
		-15,
		-15,
		0,
		0,
		-10,
		0,
		-37,
		-18
	],
	rhyphen: [
		-20,
		-20,
		0,
		0,
		-37,
		0,
		-20,
		-20
	],
	ro: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	roacute: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rocircumflex: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rodieresis: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rograve: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rohungarumlaut: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	romacron: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	roslash: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rotilde: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rperiod: [
		-60,
		-60,
		-50,
		-50,
		-100,
		-65,
		-111,
		-55
	],
	rq: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rs: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rsacute: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rscaron: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rscedilla: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rscommaaccent: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rt: [
		20,
		20,
		40,
		40
	],
	rtcommaaccent: [
		20,
		20,
		40,
		40
	],
	rv: [
		10,
		10,
		30,
		30,
		-10
	],
	ry: [
		10,
		10,
		30,
		30
	],
	ryacute: [
		10,
		10,
		30,
		30
	],
	rydieresis: [
		10,
		10,
		30,
		30
	],
	racutec: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	racutecacute: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	racuteccaron: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	racuteccedilla: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	racutecomma: [
		-60,
		-60,
		-50,
		-50,
		-92,
		-65,
		-111,
		-40
	],
	racuted: [
		-20,
		-20,
		0,
		0,
		0,
		0,
		-37
	],
	racutedcroat: [
		-20,
		-20,
		0,
		0,
		0,
		0,
		-37
	],
	racuteg: [
		-15,
		-15,
		0,
		0,
		-10,
		0,
		-37,
		-18
	],
	racutegbreve: [
		-15,
		-15,
		0,
		0,
		-10,
		0,
		-37,
		-18
	],
	racutegcommaaccent: [
		-15,
		-15,
		0,
		0,
		-10,
		0,
		-37,
		-18
	],
	racutehyphen: [
		-20,
		-20,
		0,
		0,
		-37,
		0,
		-20,
		-20
	],
	racuteo: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	racuteoacute: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	racuteocircumflex: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	racuteodieresis: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	racuteograve: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	racuteohungarumlaut: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	racuteomacron: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	racuteoslash: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	racuteotilde: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	racuteperiod: [
		-60,
		-60,
		-50,
		-50,
		-100,
		-65,
		-111,
		-55
	],
	racuteq: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	racutes: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	racutesacute: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	racutescaron: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	racutescedilla: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	racutescommaaccent: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	racutet: [
		20,
		20,
		40,
		40
	],
	racutetcommaaccent: [
		20,
		20,
		40,
		40
	],
	racutev: [
		10,
		10,
		30,
		30,
		-10
	],
	racutey: [
		10,
		10,
		30,
		30
	],
	racuteyacute: [
		10,
		10,
		30,
		30
	],
	racuteydieresis: [
		10,
		10,
		30,
		30
	],
	rcaronc: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rcaroncacute: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rcaronccaron: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rcaronccedilla: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rcaroncomma: [
		-60,
		-60,
		-50,
		-50,
		-92,
		-65,
		-111,
		-40
	],
	rcarond: [
		-20,
		-20,
		0,
		0,
		0,
		0,
		-37
	],
	rcarondcroat: [
		-20,
		-20,
		0,
		0,
		0,
		0,
		-37
	],
	rcarong: [
		-15,
		-15,
		0,
		0,
		-10,
		0,
		-37,
		-18
	],
	rcarongbreve: [
		-15,
		-15,
		0,
		0,
		-10,
		0,
		-37,
		-18
	],
	rcarongcommaaccent: [
		-15,
		-15,
		0,
		0,
		-10,
		0,
		-37,
		-18
	],
	rcaronhyphen: [
		-20,
		-20,
		0,
		0,
		-37,
		0,
		-20,
		-20
	],
	rcarono: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcaronoacute: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcaronocircumflex: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcaronodieresis: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcaronograve: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcaronohungarumlaut: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcaronomacron: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcaronoslash: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcaronotilde: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcaronperiod: [
		-60,
		-60,
		-50,
		-50,
		-100,
		-65,
		-111,
		-55
	],
	rcaronq: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rcarons: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rcaronsacute: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rcaronscaron: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rcaronscedilla: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rcaronscommaaccent: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rcaront: [
		20,
		20,
		40,
		40
	],
	rcarontcommaaccent: [
		20,
		20,
		40,
		40
	],
	rcaronv: [
		10,
		10,
		30,
		30,
		-10
	],
	rcarony: [
		10,
		10,
		30,
		30
	],
	rcaronyacute: [
		10,
		10,
		30,
		30
	],
	rcaronydieresis: [
		10,
		10,
		30,
		30
	],
	rcommaaccentc: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccentcacute: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccentccaron: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccentccedilla: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccentcomma: [
		-60,
		-60,
		-50,
		-50,
		-92,
		-65,
		-111,
		-40
	],
	rcommaaccentd: [
		-20,
		-20,
		0,
		0,
		0,
		0,
		-37
	],
	rcommaaccentdcroat: [
		-20,
		-20,
		0,
		0,
		0,
		0,
		-37
	],
	rcommaaccentg: [
		-15,
		-15,
		0,
		0,
		-10,
		0,
		-37,
		-18
	],
	rcommaaccentgbreve: [
		-15,
		-15,
		0,
		0,
		-10,
		0,
		-37,
		-18
	],
	rcommaaccentgcommaaccent: [
		-15,
		-15,
		0,
		0,
		-10,
		0,
		-37,
		-18
	],
	rcommaaccenthyphen: [
		-20,
		-20,
		0,
		0,
		-37,
		0,
		-20,
		-20
	],
	rcommaaccento: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcommaaccentoacute: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcommaaccentocircumflex: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcommaaccentodieresis: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcommaaccentograve: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcommaaccentohungarumlaut: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcommaaccentomacron: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcommaaccentoslash: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcommaaccentotilde: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-45
	],
	rcommaaccentperiod: [
		-60,
		-60,
		-50,
		-50,
		-100,
		-65,
		-111,
		-55
	],
	rcommaaccentq: [
		-20,
		-20,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccents: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rcommaaccentsacute: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rcommaaccentscaron: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rcommaaccentscedilla: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rcommaaccentscommaaccent: [
		-15,
		-15,
		0,
		0,
		0,
		0,
		-10
	],
	rcommaaccentt: [
		20,
		20,
		40,
		40
	],
	rcommaaccenttcommaaccent: [
		20,
		20,
		40,
		40
	],
	rcommaaccentv: [
		10,
		10,
		30,
		30,
		-10
	],
	rcommaaccenty: [
		10,
		10,
		30,
		30
	],
	rcommaaccentyacute: [
		10,
		10,
		30,
		30
	],
	rcommaaccentydieresis: [
		10,
		10,
		30,
		30
	],
	sw: [
		-15,
		-15,
		-30,
		-30
	],
	sacutew: [
		-15,
		-15,
		-30,
		-30
	],
	scaronw: [
		-15,
		-15,
		-30,
		-30
	],
	scedillaw: [
		-15,
		-15,
		-30,
		-30
	],
	scommaaccentw: [
		-15,
		-15,
		-30,
		-30
	],
	semicolonspace: [
		-40,
		-40,
		-50,
		-50
	],
	spaceT: [
		-100,
		-100,
		-50,
		-50,
		-30,
		0,
		-18,
		-18
	],
	spaceTcaron: [
		-100,
		-100,
		-50,
		-50,
		-30,
		0,
		-18,
		-18
	],
	spaceTcommaaccent: [
		-100,
		-100,
		-50,
		-50,
		-30,
		0,
		-18,
		-18
	],
	spaceV: [
		-80,
		-80,
		-50,
		-50,
		-45,
		-70,
		-35,
		-50
	],
	spaceW: [
		-80,
		-80,
		-40,
		-40,
		-30,
		-70,
		-40,
		-30
	],
	spaceY: [
		-120,
		-120,
		-90,
		-90,
		-55,
		-70,
		-75,
		-90
	],
	spaceYacute: [
		-120,
		-120,
		-90,
		-90,
		-55,
		-70,
		-75,
		-90
	],
	spaceYdieresis: [
		-120,
		-120,
		-90,
		-90,
		-55,
		-70,
		-75,
		-90
	],
	spacequotedblleft: [
		-80,
		-80,
		-30,
		-30
	],
	spacequoteleft: [
		-60,
		-60,
		-60,
		-60
	],
	va: [
		-20,
		-20,
		-25,
		-25,
		-10,
		0,
		0,
		-25
	],
	vaacute: [
		-20,
		-20,
		-25,
		-25,
		-10,
		0,
		0,
		-25
	],
	vabreve: [
		-20,
		-20,
		-25,
		-25,
		-10,
		0,
		0,
		-25
	],
	vacircumflex: [
		-20,
		-20,
		-25,
		-25,
		-10,
		0,
		0,
		-25
	],
	vadieresis: [
		-20,
		-20,
		-25,
		-25,
		-10,
		0,
		0,
		-25
	],
	vagrave: [
		-20,
		-20,
		-25,
		-25,
		-10,
		0,
		0,
		-25
	],
	vamacron: [
		-20,
		-20,
		-25,
		-25,
		-10,
		0,
		0,
		-25
	],
	vaogonek: [
		-20,
		-20,
		-25,
		-25,
		-10,
		0,
		0,
		-25
	],
	varing: [
		-20,
		-20,
		-25,
		-25,
		-10,
		0,
		0,
		-25
	],
	vatilde: [
		-20,
		-20,
		-25,
		-25,
		-10,
		0,
		0,
		-25
	],
	vcomma: [
		-80,
		-80,
		-80,
		-80,
		-55,
		-37,
		-74,
		-65
	],
	vo: [
		-30,
		-30,
		-25,
		-25,
		-10,
		-15,
		0,
		-20
	],
	voacute: [
		-30,
		-30,
		-25,
		-25,
		-10,
		-15,
		0,
		-20
	],
	vocircumflex: [
		-30,
		-30,
		-25,
		-25,
		-10,
		-15,
		0,
		-20
	],
	vodieresis: [
		-30,
		-30,
		-25,
		-25,
		-10,
		-15,
		0,
		-20
	],
	vograve: [
		-30,
		-30,
		-25,
		-25,
		-10,
		-15,
		0,
		-20
	],
	vohungarumlaut: [
		-30,
		-30,
		-25,
		-25,
		-10,
		-15,
		0,
		-20
	],
	vomacron: [
		-30,
		-30,
		-25,
		-25,
		-10,
		-15,
		0,
		-20
	],
	voslash: [
		-30,
		-30,
		-25,
		-25,
		-10,
		-15,
		0,
		-20
	],
	votilde: [
		-30,
		-30,
		-25,
		-25,
		-10,
		-15,
		0,
		-20
	],
	vperiod: [
		-80,
		-80,
		-80,
		-80,
		-70,
		-37,
		-74,
		-65
	],
	wcomma: [
		-40,
		-40,
		-60,
		-60,
		-55,
		-37,
		-74,
		-65
	],
	wo: [
		-20,
		-20,
		-10,
		-10,
		-10,
		-15,
		0,
		-10
	],
	woacute: [
		-20,
		-20,
		-10,
		-10,
		-10,
		-15,
		0,
		-10
	],
	wocircumflex: [
		-20,
		-20,
		-10,
		-10,
		-10,
		-15,
		0,
		-10
	],
	wodieresis: [
		-20,
		-20,
		-10,
		-10,
		-10,
		-15,
		0,
		-10
	],
	wograve: [
		-20,
		-20,
		-10,
		-10,
		-10,
		-15,
		0,
		-10
	],
	wohungarumlaut: [
		-20,
		-20,
		-10,
		-10,
		-10,
		-15,
		0,
		-10
	],
	womacron: [
		-20,
		-20,
		-10,
		-10,
		-10,
		-15,
		0,
		-10
	],
	woslash: [
		-20,
		-20,
		-10,
		-10,
		-10,
		-15,
		0,
		-10
	],
	wotilde: [
		-20,
		-20,
		-10,
		-10,
		-10,
		-15,
		0,
		-10
	],
	wperiod: [
		-40,
		-40,
		-60,
		-60,
		-70,
		-37,
		-74,
		-65
	],
	xe: [
		-10,
		-10,
		-30,
		-30,
		0,
		-10,
		0,
		-15
	],
	xeacute: [
		-10,
		-10,
		-30,
		-30,
		0,
		-10,
		0,
		-15
	],
	xecaron: [
		-10,
		-10,
		-30,
		-30,
		0,
		-10,
		0,
		-15
	],
	xecircumflex: [
		-10,
		-10,
		-30,
		-30,
		0,
		-10,
		0,
		-15
	],
	xedieresis: [
		-10,
		-10,
		-30,
		-30,
		0,
		-10,
		0,
		-15
	],
	xedotaccent: [
		-10,
		-10,
		-30,
		-30,
		0,
		-10,
		0,
		-15
	],
	xegrave: [
		-10,
		-10,
		-30,
		-30,
		0,
		-10,
		0,
		-15
	],
	xemacron: [
		-10,
		-10,
		-30,
		-30,
		0,
		-10,
		0,
		-15
	],
	xeogonek: [
		-10,
		-10,
		-30,
		-30,
		0,
		-10,
		0,
		-15
	],
	ya: [
		-30,
		-30,
		-20,
		-20
	],
	yaacute: [
		-30,
		-30,
		-20,
		-20
	],
	yabreve: [
		-30,
		-30,
		-20,
		-20
	],
	yacircumflex: [
		-30,
		-30,
		-20,
		-20
	],
	yadieresis: [
		-30,
		-30,
		-20,
		-20
	],
	yagrave: [
		-30,
		-30,
		-20,
		-20
	],
	yamacron: [
		-30,
		-30,
		-20,
		-20
	],
	yaogonek: [
		-30,
		-30,
		-20,
		-20
	],
	yaring: [
		-30,
		-30,
		-20,
		-20
	],
	yatilde: [
		-30,
		-30,
		-20,
		-20
	],
	ycomma: [
		-80,
		-80,
		-100,
		-100,
		-55,
		-37,
		-55,
		-65
	],
	ye: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yeacute: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yecaron: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yecircumflex: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yedieresis: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yedotaccent: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yegrave: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yemacron: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yeogonek: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yo: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yoacute: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yocircumflex: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yodieresis: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yograve: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yohungarumlaut: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yomacron: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yoslash: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yotilde: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yperiod: [
		-80,
		-80,
		-100,
		-100,
		-70,
		-37,
		-55,
		-65
	],
	yacutea: [
		-30,
		-30,
		-20,
		-20
	],
	yacuteaacute: [
		-30,
		-30,
		-20,
		-20
	],
	yacuteabreve: [
		-30,
		-30,
		-20,
		-20
	],
	yacuteacircumflex: [
		-30,
		-30,
		-20,
		-20
	],
	yacuteadieresis: [
		-30,
		-30,
		-20,
		-20
	],
	yacuteagrave: [
		-30,
		-30,
		-20,
		-20
	],
	yacuteamacron: [
		-30,
		-30,
		-20,
		-20
	],
	yacuteaogonek: [
		-30,
		-30,
		-20,
		-20
	],
	yacutearing: [
		-30,
		-30,
		-20,
		-20
	],
	yacuteatilde: [
		-30,
		-30,
		-20,
		-20
	],
	yacutecomma: [
		-80,
		-80,
		-100,
		-100,
		-55,
		-37,
		-55,
		-65
	],
	yacutee: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yacuteeacute: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yacuteecaron: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yacuteecircumflex: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yacuteedieresis: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yacuteedotaccent: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yacuteegrave: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yacuteemacron: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yacuteeogonek: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	yacuteo: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yacuteoacute: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yacuteocircumflex: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yacuteodieresis: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yacuteograve: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yacuteohungarumlaut: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yacuteomacron: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yacuteoslash: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yacuteotilde: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	yacuteperiod: [
		-80,
		-80,
		-100,
		-100,
		-70,
		-37,
		-55,
		-65
	],
	ydieresisa: [
		-30,
		-30,
		-20,
		-20
	],
	ydieresisaacute: [
		-30,
		-30,
		-20,
		-20
	],
	ydieresisabreve: [
		-30,
		-30,
		-20,
		-20
	],
	ydieresisacircumflex: [
		-30,
		-30,
		-20,
		-20
	],
	ydieresisadieresis: [
		-30,
		-30,
		-20,
		-20
	],
	ydieresisagrave: [
		-30,
		-30,
		-20,
		-20
	],
	ydieresisamacron: [
		-30,
		-30,
		-20,
		-20
	],
	ydieresisaogonek: [
		-30,
		-30,
		-20,
		-20
	],
	ydieresisaring: [
		-30,
		-30,
		-20,
		-20
	],
	ydieresisatilde: [
		-30,
		-30,
		-20,
		-20
	],
	ydieresiscomma: [
		-80,
		-80,
		-100,
		-100,
		-55,
		-37,
		-55,
		-65
	],
	ydieresise: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	ydieresiseacute: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	ydieresisecaron: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	ydieresisecircumflex: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	ydieresisedieresis: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	ydieresisedotaccent: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	ydieresisegrave: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	ydieresisemacron: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	ydieresiseogonek: [
		-10,
		-10,
		-20,
		-20,
		-10
	],
	ydieresiso: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	ydieresisoacute: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	ydieresisocircumflex: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	ydieresisodieresis: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	ydieresisograve: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	ydieresisohungarumlaut: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	ydieresisomacron: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	ydieresisoslash: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	ydieresisotilde: [
		-25,
		-25,
		-20,
		-20,
		-25
	],
	ydieresisperiod: [
		-80,
		-80,
		-100,
		-100,
		-70,
		-37,
		-55,
		-65
	],
	ze: [
		10,
		10,
		-15,
		-15
	],
	zeacute: [
		10,
		10,
		-15,
		-15
	],
	zecaron: [
		10,
		10,
		-15,
		-15
	],
	zecircumflex: [
		10,
		10,
		-15,
		-15
	],
	zedieresis: [
		10,
		10,
		-15,
		-15
	],
	zedotaccent: [
		10,
		10,
		-15,
		-15
	],
	zegrave: [
		10,
		10,
		-15,
		-15
	],
	zemacron: [
		10,
		10,
		-15,
		-15
	],
	zeogonek: [
		10,
		10,
		-15,
		-15
	],
	zacutee: [
		10,
		10,
		-15,
		-15
	],
	zacuteeacute: [
		10,
		10,
		-15,
		-15
	],
	zacuteecaron: [
		10,
		10,
		-15,
		-15
	],
	zacuteecircumflex: [
		10,
		10,
		-15,
		-15
	],
	zacuteedieresis: [
		10,
		10,
		-15,
		-15
	],
	zacuteedotaccent: [
		10,
		10,
		-15,
		-15
	],
	zacuteegrave: [
		10,
		10,
		-15,
		-15
	],
	zacuteemacron: [
		10,
		10,
		-15,
		-15
	],
	zacuteeogonek: [
		10,
		10,
		-15,
		-15
	],
	zcarone: [
		10,
		10,
		-15,
		-15
	],
	zcaroneacute: [
		10,
		10,
		-15,
		-15
	],
	zcaronecaron: [
		10,
		10,
		-15,
		-15
	],
	zcaronecircumflex: [
		10,
		10,
		-15,
		-15
	],
	zcaronedieresis: [
		10,
		10,
		-15,
		-15
	],
	zcaronedotaccent: [
		10,
		10,
		-15,
		-15
	],
	zcaronegrave: [
		10,
		10,
		-15,
		-15
	],
	zcaronemacron: [
		10,
		10,
		-15,
		-15
	],
	zcaroneogonek: [
		10,
		10,
		-15,
		-15
	],
	zdotaccente: [
		10,
		10,
		-15,
		-15
	],
	zdotaccenteacute: [
		10,
		10,
		-15,
		-15
	],
	zdotaccentecaron: [
		10,
		10,
		-15,
		-15
	],
	zdotaccentecircumflex: [
		10,
		10,
		-15,
		-15
	],
	zdotaccentedieresis: [
		10,
		10,
		-15,
		-15
	],
	zdotaccentedotaccent: [
		10,
		10,
		-15,
		-15
	],
	zdotaccentegrave: [
		10,
		10,
		-15,
		-15
	],
	zdotaccentemacron: [
		10,
		10,
		-15,
		-15
	],
	zdotaccenteogonek: [
		10,
		10,
		-15,
		-15
	],
	Bcomma: [
		0,
		0,
		-20,
		-20
	],
	Bperiod: [
		0,
		0,
		-20,
		-20
	],
	Ccomma: [
		0,
		0,
		-30,
		-30
	],
	Cperiod: [
		0,
		0,
		-30,
		-30
	],
	Cacutecomma: [
		0,
		0,
		-30,
		-30
	],
	Cacuteperiod: [
		0,
		0,
		-30,
		-30
	],
	Ccaroncomma: [
		0,
		0,
		-30,
		-30
	],
	Ccaronperiod: [
		0,
		0,
		-30,
		-30
	],
	Ccedillacomma: [
		0,
		0,
		-30,
		-30
	],
	Ccedillaperiod: [
		0,
		0,
		-30,
		-30
	],
	Fe: [
		0,
		0,
		-30,
		-30,
		-25,
		-100,
		-75
	],
	Feacute: [
		0,
		0,
		-30,
		-30,
		-25,
		-100,
		-75
	],
	Fecaron: [
		0,
		0,
		-30,
		-30,
		-25,
		-100,
		-75
	],
	Fecircumflex: [
		0,
		0,
		-30,
		-30,
		-25,
		-100,
		-75
	],
	Fedieresis: [
		0,
		0,
		-30,
		-30,
		-25,
		-100,
		-75
	],
	Fedotaccent: [
		0,
		0,
		-30,
		-30,
		-25,
		-100,
		-75
	],
	Fegrave: [
		0,
		0,
		-30,
		-30,
		-25,
		-100,
		-75
	],
	Femacron: [
		0,
		0,
		-30,
		-30,
		-25,
		-100,
		-75
	],
	Feogonek: [
		0,
		0,
		-30,
		-30,
		-25,
		-100,
		-75
	],
	Fo: [
		0,
		0,
		-30,
		-30,
		-25,
		-70,
		-105,
		-15
	],
	Foacute: [
		0,
		0,
		-30,
		-30,
		-25,
		-70,
		-105,
		-15
	],
	Focircumflex: [
		0,
		0,
		-30,
		-30,
		-25,
		-70,
		-105,
		-15
	],
	Fodieresis: [
		0,
		0,
		-30,
		-30,
		-25,
		-70,
		-105,
		-15
	],
	Fograve: [
		0,
		0,
		-30,
		-30,
		-25,
		-70,
		-105,
		-15
	],
	Fohungarumlaut: [
		0,
		0,
		-30,
		-30,
		-25,
		-70,
		-105,
		-15
	],
	Fomacron: [
		0,
		0,
		-30,
		-30,
		-25,
		-70,
		-105,
		-15
	],
	Foslash: [
		0,
		0,
		-30,
		-30,
		-25,
		-70,
		-105,
		-15
	],
	Fotilde: [
		0,
		0,
		-30,
		-30,
		-25,
		-70,
		-105,
		-15
	],
	Fr: [
		0,
		0,
		-45,
		-45,
		0,
		-50,
		-55
	],
	Fracute: [
		0,
		0,
		-45,
		-45,
		0,
		-50,
		-55
	],
	Frcaron: [
		0,
		0,
		-45,
		-45,
		0,
		-50,
		-55
	],
	Frcommaaccent: [
		0,
		0,
		-45,
		-45,
		0,
		-50,
		-55
	],
	Ja: [
		0,
		0,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Jaacute: [
		0,
		0,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Jabreve: [
		0,
		0,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Jacircumflex: [
		0,
		0,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Jadieresis: [
		0,
		0,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Jagrave: [
		0,
		0,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Jamacron: [
		0,
		0,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Jaogonek: [
		0,
		0,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Jaring: [
		0,
		0,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	Jatilde: [
		0,
		0,
		-20,
		-20,
		-15,
		-40,
		-35
	],
	LcaronT: [
		0,
		0,
		-110,
		-110
	],
	LcaronTcaron: [
		0,
		0,
		-110,
		-110
	],
	LcaronTcommaaccent: [
		0,
		0,
		-110,
		-110
	],
	LcaronV: [
		0,
		0,
		-110,
		-110
	],
	LcaronW: [
		0,
		0,
		-70,
		-70
	],
	LcaronY: [
		0,
		0,
		-140,
		-140
	],
	LcaronYacute: [
		0,
		0,
		-140,
		-140
	],
	LcaronYdieresis: [
		0,
		0,
		-140,
		-140
	],
	Lcaronquotedblright: [
		0,
		0,
		-140,
		-140
	],
	Lcaronquoteright: [
		0,
		0,
		-160,
		-160,
		0,
		0,
		0,
		-92
	],
	Lcarony: [
		0,
		0,
		-30,
		-30,
		0,
		0,
		0,
		-55
	],
	Lcaronyacute: [
		0,
		0,
		-30,
		-30,
		0,
		0,
		0,
		-55
	],
	Lcaronydieresis: [
		0,
		0,
		-30,
		-30,
		0,
		0,
		0,
		-55
	],
	Scomma: [
		0,
		0,
		-20,
		-20
	],
	Speriod: [
		0,
		0,
		-20,
		-20
	],
	Sacutecomma: [
		0,
		0,
		-20,
		-20
	],
	Sacuteperiod: [
		0,
		0,
		-20,
		-20
	],
	Scaroncomma: [
		0,
		0,
		-20,
		-20
	],
	Scaronperiod: [
		0,
		0,
		-20,
		-20
	],
	Scedillacomma: [
		0,
		0,
		-20,
		-20
	],
	Scedillaperiod: [
		0,
		0,
		-20,
		-20
	],
	Scommaaccentcomma: [
		0,
		0,
		-20,
		-20
	],
	Scommaaccentperiod: [
		0,
		0,
		-20,
		-20
	],
	Trcaron: [
		0,
		0,
		-120,
		-120,
		-74,
		-37,
		-55,
		-35
	],
	Tcaronrcaron: [
		0,
		0,
		-120,
		-120,
		-74,
		-37,
		-55,
		-35
	],
	Tcommaaccentrcaron: [
		0,
		0,
		-120,
		-120,
		-74,
		-37,
		-55,
		-35
	],
	Yhyphen: [
		0,
		0,
		-140,
		-140,
		-92,
		-92,
		-74,
		-111
	],
	Yi: [
		0,
		0,
		-20,
		-20,
		-37,
		-55,
		-74,
		-55
	],
	Yiacute: [
		0,
		0,
		-20,
		-20,
		-37,
		-55,
		-74,
		-55
	],
	Yiogonek: [
		0,
		0,
		-20,
		-20,
		-37,
		-55,
		-74,
		-55
	],
	Yacutehyphen: [
		0,
		0,
		-140,
		-140,
		-92,
		-92,
		-74,
		-111
	],
	Yacutei: [
		0,
		0,
		-20,
		-20,
		-37,
		-55,
		-74,
		-55
	],
	Yacuteiacute: [
		0,
		0,
		-20,
		-20,
		-37,
		-55,
		-74,
		-55
	],
	Yacuteiogonek: [
		0,
		0,
		-20,
		-20,
		-37,
		-55,
		-74,
		-55
	],
	Ydieresishyphen: [
		0,
		0,
		-140,
		-140,
		-92,
		-92,
		-74,
		-111
	],
	Ydieresisi: [
		0,
		0,
		-20,
		-20,
		-37,
		-55,
		-74,
		-55
	],
	Ydieresisiacute: [
		0,
		0,
		-20,
		-20,
		-37,
		-55,
		-74,
		-55
	],
	Ydieresisiogonek: [
		0,
		0,
		-20,
		-20,
		-37,
		-55,
		-74,
		-55
	],
	bb: [
		0,
		0,
		-10,
		-10,
		-10,
		-10
	],
	bcomma: [
		0,
		0,
		-40,
		-40
	],
	bperiod: [
		0,
		0,
		-40,
		-40,
		-40,
		-40,
		-40,
		-40
	],
	ccomma: [
		0,
		0,
		-15,
		-15
	],
	cacutecomma: [
		0,
		0,
		-15,
		-15
	],
	ccaroncomma: [
		0,
		0,
		-15,
		-15
	],
	ccedillacomma: [
		0,
		0,
		-15,
		-15
	],
	fa: [
		0,
		0,
		-30,
		-30,
		0,
		0,
		0,
		-10
	],
	faacute: [
		0,
		0,
		-30,
		-30,
		0,
		0,
		0,
		-10
	],
	fabreve: [
		0,
		0,
		-30,
		-30,
		0,
		0,
		0,
		-10
	],
	facircumflex: [
		0,
		0,
		-30,
		-30,
		0,
		0,
		0,
		-10
	],
	fadieresis: [
		0,
		0,
		-30,
		-30,
		0,
		0,
		0,
		-10
	],
	fagrave: [
		0,
		0,
		-30,
		-30,
		0,
		0,
		0,
		-10
	],
	famacron: [
		0,
		0,
		-30,
		-30,
		0,
		0,
		0,
		-10
	],
	faogonek: [
		0,
		0,
		-30,
		-30,
		0,
		0,
		0,
		-10
	],
	faring: [
		0,
		0,
		-30,
		-30,
		0,
		0,
		0,
		-10
	],
	fatilde: [
		0,
		0,
		-30,
		-30,
		0,
		0,
		0,
		-10
	],
	fdotlessi: [
		0,
		0,
		-28,
		-28,
		-35,
		-30,
		-60,
		-50
	],
	gr: [
		0,
		0,
		-10,
		-10
	],
	gracute: [
		0,
		0,
		-10,
		-10
	],
	grcaron: [
		0,
		0,
		-10,
		-10
	],
	grcommaaccent: [
		0,
		0,
		-10,
		-10
	],
	gbrever: [
		0,
		0,
		-10,
		-10
	],
	gbreveracute: [
		0,
		0,
		-10,
		-10
	],
	gbrevercaron: [
		0,
		0,
		-10,
		-10
	],
	gbrevercommaaccent: [
		0,
		0,
		-10,
		-10
	],
	gcommaaccentr: [
		0,
		0,
		-10,
		-10
	],
	gcommaaccentracute: [
		0,
		0,
		-10,
		-10
	],
	gcommaaccentrcaron: [
		0,
		0,
		-10,
		-10
	],
	gcommaaccentrcommaaccent: [
		0,
		0,
		-10,
		-10
	],
	ke: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	keacute: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kecaron: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kecircumflex: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kedieresis: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kedotaccent: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kegrave: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kemacron: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	keogonek: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kcommaaccente: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kcommaaccenteacute: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kcommaaccentecaron: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kcommaaccentecircumflex: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kcommaaccentedieresis: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kcommaaccentedotaccent: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kcommaaccentegrave: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kcommaaccentemacron: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	kcommaaccenteogonek: [
		0,
		0,
		-20,
		-20,
		-10,
		-30,
		-10,
		-10
	],
	ocomma: [
		0,
		0,
		-40,
		-40
	],
	operiod: [
		0,
		0,
		-40,
		-40
	],
	oacutecomma: [
		0,
		0,
		-40,
		-40
	],
	oacuteperiod: [
		0,
		0,
		-40,
		-40
	],
	ocircumflexcomma: [
		0,
		0,
		-40,
		-40
	],
	ocircumflexperiod: [
		0,
		0,
		-40,
		-40
	],
	odieresiscomma: [
		0,
		0,
		-40,
		-40
	],
	odieresisperiod: [
		0,
		0,
		-40,
		-40
	],
	ogravecomma: [
		0,
		0,
		-40,
		-40
	],
	ograveperiod: [
		0,
		0,
		-40,
		-40
	],
	ohungarumlautcomma: [
		0,
		0,
		-40,
		-40
	],
	ohungarumlautperiod: [
		0,
		0,
		-40,
		-40
	],
	omacroncomma: [
		0,
		0,
		-40,
		-40
	],
	omacronperiod: [
		0,
		0,
		-40,
		-40
	],
	oslasha: [
		0,
		0,
		-55,
		-55
	],
	oslashaacute: [
		0,
		0,
		-55,
		-55
	],
	oslashabreve: [
		0,
		0,
		-55,
		-55
	],
	oslashacircumflex: [
		0,
		0,
		-55,
		-55
	],
	oslashadieresis: [
		0,
		0,
		-55,
		-55
	],
	oslashagrave: [
		0,
		0,
		-55,
		-55
	],
	oslashamacron: [
		0,
		0,
		-55,
		-55
	],
	oslashaogonek: [
		0,
		0,
		-55,
		-55
	],
	oslasharing: [
		0,
		0,
		-55,
		-55
	],
	oslashatilde: [
		0,
		0,
		-55,
		-55
	],
	oslashb: [
		0,
		0,
		-55,
		-55
	],
	oslashc: [
		0,
		0,
		-55,
		-55
	],
	oslashcacute: [
		0,
		0,
		-55,
		-55
	],
	oslashccaron: [
		0,
		0,
		-55,
		-55
	],
	oslashccedilla: [
		0,
		0,
		-55,
		-55
	],
	oslashcomma: [
		0,
		0,
		-95,
		-95
	],
	oslashd: [
		0,
		0,
		-55,
		-55
	],
	oslashdcroat: [
		0,
		0,
		-55,
		-55
	],
	oslashe: [
		0,
		0,
		-55,
		-55
	],
	oslasheacute: [
		0,
		0,
		-55,
		-55
	],
	oslashecaron: [
		0,
		0,
		-55,
		-55
	],
	oslashecircumflex: [
		0,
		0,
		-55,
		-55
	],
	oslashedieresis: [
		0,
		0,
		-55,
		-55
	],
	oslashedotaccent: [
		0,
		0,
		-55,
		-55
	],
	oslashegrave: [
		0,
		0,
		-55,
		-55
	],
	oslashemacron: [
		0,
		0,
		-55,
		-55
	],
	oslasheogonek: [
		0,
		0,
		-55,
		-55
	],
	oslashf: [
		0,
		0,
		-55,
		-55
	],
	oslashg: [
		0,
		0,
		-55,
		-55,
		0,
		0,
		-10
	],
	oslashgbreve: [
		0,
		0,
		-55,
		-55,
		0,
		0,
		-10
	],
	oslashgcommaaccent: [
		0,
		0,
		-55,
		-55,
		0,
		0,
		-10
	],
	oslashh: [
		0,
		0,
		-55,
		-55
	],
	oslashi: [
		0,
		0,
		-55,
		-55
	],
	oslashiacute: [
		0,
		0,
		-55,
		-55
	],
	oslashicircumflex: [
		0,
		0,
		-55,
		-55
	],
	oslashidieresis: [
		0,
		0,
		-55,
		-55
	],
	oslashigrave: [
		0,
		0,
		-55,
		-55
	],
	oslashimacron: [
		0,
		0,
		-55,
		-55
	],
	oslashiogonek: [
		0,
		0,
		-55,
		-55
	],
	oslashj: [
		0,
		0,
		-55,
		-55
	],
	oslashk: [
		0,
		0,
		-55,
		-55
	],
	oslashkcommaaccent: [
		0,
		0,
		-55,
		-55
	],
	oslashl: [
		0,
		0,
		-55,
		-55
	],
	oslashlacute: [
		0,
		0,
		-55,
		-55
	],
	oslashlcommaaccent: [
		0,
		0,
		-55,
		-55
	],
	oslashlslash: [
		0,
		0,
		-55,
		-55
	],
	oslashm: [
		0,
		0,
		-55,
		-55
	],
	oslashn: [
		0,
		0,
		-55,
		-55
	],
	oslashnacute: [
		0,
		0,
		-55,
		-55
	],
	oslashncaron: [
		0,
		0,
		-55,
		-55
	],
	oslashncommaaccent: [
		0,
		0,
		-55,
		-55
	],
	oslashntilde: [
		0,
		0,
		-55,
		-55
	],
	oslasho: [
		0,
		0,
		-55,
		-55
	],
	oslashoacute: [
		0,
		0,
		-55,
		-55
	],
	oslashocircumflex: [
		0,
		0,
		-55,
		-55
	],
	oslashodieresis: [
		0,
		0,
		-55,
		-55
	],
	oslashograve: [
		0,
		0,
		-55,
		-55
	],
	oslashohungarumlaut: [
		0,
		0,
		-55,
		-55
	],
	oslashomacron: [
		0,
		0,
		-55,
		-55
	],
	oslashoslash: [
		0,
		0,
		-55,
		-55
	],
	oslashotilde: [
		0,
		0,
		-55,
		-55
	],
	oslashp: [
		0,
		0,
		-55,
		-55
	],
	oslashperiod: [
		0,
		0,
		-95,
		-95
	],
	oslashq: [
		0,
		0,
		-55,
		-55
	],
	oslashr: [
		0,
		0,
		-55,
		-55
	],
	oslashracute: [
		0,
		0,
		-55,
		-55
	],
	oslashrcaron: [
		0,
		0,
		-55,
		-55
	],
	oslashrcommaaccent: [
		0,
		0,
		-55,
		-55
	],
	oslashs: [
		0,
		0,
		-55,
		-55
	],
	oslashsacute: [
		0,
		0,
		-55,
		-55
	],
	oslashscaron: [
		0,
		0,
		-55,
		-55
	],
	oslashscedilla: [
		0,
		0,
		-55,
		-55
	],
	oslashscommaaccent: [
		0,
		0,
		-55,
		-55
	],
	oslasht: [
		0,
		0,
		-55,
		-55
	],
	oslashtcommaaccent: [
		0,
		0,
		-55,
		-55
	],
	oslashu: [
		0,
		0,
		-55,
		-55
	],
	oslashuacute: [
		0,
		0,
		-55,
		-55
	],
	oslashucircumflex: [
		0,
		0,
		-55,
		-55
	],
	oslashudieresis: [
		0,
		0,
		-55,
		-55
	],
	oslashugrave: [
		0,
		0,
		-55,
		-55
	],
	oslashuhungarumlaut: [
		0,
		0,
		-55,
		-55
	],
	oslashumacron: [
		0,
		0,
		-55,
		-55
	],
	oslashuogonek: [
		0,
		0,
		-55,
		-55
	],
	oslashuring: [
		0,
		0,
		-55,
		-55
	],
	oslashz: [
		0,
		0,
		-55,
		-55
	],
	oslashzacute: [
		0,
		0,
		-55,
		-55
	],
	oslashzcaron: [
		0,
		0,
		-55,
		-55
	],
	oslashzdotaccent: [
		0,
		0,
		-55,
		-55
	],
	otildecomma: [
		0,
		0,
		-40,
		-40
	],
	otildeperiod: [
		0,
		0,
		-40,
		-40
	],
	pcomma: [
		0,
		0,
		-35,
		-35
	],
	pperiod: [
		0,
		0,
		-35,
		-35
	],
	ra: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	raacute: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rabreve: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	racircumflex: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	radieresis: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	ragrave: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	ramacron: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	raogonek: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	raring: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	ratilde: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcolon: [
		0,
		0,
		30,
		30
	],
	ri: [
		0,
		0,
		15,
		15
	],
	riacute: [
		0,
		0,
		15,
		15
	],
	ricircumflex: [
		0,
		0,
		15,
		15
	],
	ridieresis: [
		0,
		0,
		15,
		15
	],
	rigrave: [
		0,
		0,
		15,
		15
	],
	rimacron: [
		0,
		0,
		15,
		15
	],
	riogonek: [
		0,
		0,
		15,
		15
	],
	rk: [
		0,
		0,
		15,
		15
	],
	rkcommaaccent: [
		0,
		0,
		15,
		15
	],
	rl: [
		0,
		0,
		15,
		15
	],
	rlacute: [
		0,
		0,
		15,
		15
	],
	rlcommaaccent: [
		0,
		0,
		15,
		15
	],
	rlslash: [
		0,
		0,
		15,
		15
	],
	rm: [
		0,
		0,
		25,
		25
	],
	rn: [
		0,
		0,
		25,
		25,
		-15
	],
	rnacute: [
		0,
		0,
		25,
		25,
		-15
	],
	rncaron: [
		0,
		0,
		25,
		25,
		-15
	],
	rncommaaccent: [
		0,
		0,
		25,
		25,
		-15
	],
	rntilde: [
		0,
		0,
		25,
		25,
		-15
	],
	rp: [
		0,
		0,
		30,
		30,
		-10
	],
	rsemicolon: [
		0,
		0,
		30,
		30
	],
	ru: [
		0,
		0,
		15,
		15
	],
	ruacute: [
		0,
		0,
		15,
		15
	],
	rucircumflex: [
		0,
		0,
		15,
		15
	],
	rudieresis: [
		0,
		0,
		15,
		15
	],
	rugrave: [
		0,
		0,
		15,
		15
	],
	ruhungarumlaut: [
		0,
		0,
		15,
		15
	],
	rumacron: [
		0,
		0,
		15,
		15
	],
	ruogonek: [
		0,
		0,
		15,
		15
	],
	ruring: [
		0,
		0,
		15,
		15
	],
	racutea: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	racuteaacute: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	racuteabreve: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	racuteacircumflex: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	racuteadieresis: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	racuteagrave: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	racuteamacron: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	racuteaogonek: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	racutearing: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	racuteatilde: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	racutecolon: [
		0,
		0,
		30,
		30
	],
	racutei: [
		0,
		0,
		15,
		15
	],
	racuteiacute: [
		0,
		0,
		15,
		15
	],
	racuteicircumflex: [
		0,
		0,
		15,
		15
	],
	racuteidieresis: [
		0,
		0,
		15,
		15
	],
	racuteigrave: [
		0,
		0,
		15,
		15
	],
	racuteimacron: [
		0,
		0,
		15,
		15
	],
	racuteiogonek: [
		0,
		0,
		15,
		15
	],
	racutek: [
		0,
		0,
		15,
		15
	],
	racutekcommaaccent: [
		0,
		0,
		15,
		15
	],
	racutel: [
		0,
		0,
		15,
		15
	],
	racutelacute: [
		0,
		0,
		15,
		15
	],
	racutelcommaaccent: [
		0,
		0,
		15,
		15
	],
	racutelslash: [
		0,
		0,
		15,
		15
	],
	racutem: [
		0,
		0,
		25,
		25
	],
	racuten: [
		0,
		0,
		25,
		25,
		-15
	],
	racutenacute: [
		0,
		0,
		25,
		25,
		-15
	],
	racutencaron: [
		0,
		0,
		25,
		25,
		-15
	],
	racutencommaaccent: [
		0,
		0,
		25,
		25,
		-15
	],
	racutentilde: [
		0,
		0,
		25,
		25,
		-15
	],
	racutep: [
		0,
		0,
		30,
		30,
		-10
	],
	racutesemicolon: [
		0,
		0,
		30,
		30
	],
	racuteu: [
		0,
		0,
		15,
		15
	],
	racuteuacute: [
		0,
		0,
		15,
		15
	],
	racuteucircumflex: [
		0,
		0,
		15,
		15
	],
	racuteudieresis: [
		0,
		0,
		15,
		15
	],
	racuteugrave: [
		0,
		0,
		15,
		15
	],
	racuteuhungarumlaut: [
		0,
		0,
		15,
		15
	],
	racuteumacron: [
		0,
		0,
		15,
		15
	],
	racuteuogonek: [
		0,
		0,
		15,
		15
	],
	racuteuring: [
		0,
		0,
		15,
		15
	],
	rcarona: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcaronaacute: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcaronabreve: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcaronacircumflex: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcaronadieresis: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcaronagrave: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcaronamacron: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcaronaogonek: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcaronaring: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcaronatilde: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcaroncolon: [
		0,
		0,
		30,
		30
	],
	rcaroni: [
		0,
		0,
		15,
		15
	],
	rcaroniacute: [
		0,
		0,
		15,
		15
	],
	rcaronicircumflex: [
		0,
		0,
		15,
		15
	],
	rcaronidieresis: [
		0,
		0,
		15,
		15
	],
	rcaronigrave: [
		0,
		0,
		15,
		15
	],
	rcaronimacron: [
		0,
		0,
		15,
		15
	],
	rcaroniogonek: [
		0,
		0,
		15,
		15
	],
	rcaronk: [
		0,
		0,
		15,
		15
	],
	rcaronkcommaaccent: [
		0,
		0,
		15,
		15
	],
	rcaronl: [
		0,
		0,
		15,
		15
	],
	rcaronlacute: [
		0,
		0,
		15,
		15
	],
	rcaronlcommaaccent: [
		0,
		0,
		15,
		15
	],
	rcaronlslash: [
		0,
		0,
		15,
		15
	],
	rcaronm: [
		0,
		0,
		25,
		25
	],
	rcaronn: [
		0,
		0,
		25,
		25,
		-15
	],
	rcaronnacute: [
		0,
		0,
		25,
		25,
		-15
	],
	rcaronncaron: [
		0,
		0,
		25,
		25,
		-15
	],
	rcaronncommaaccent: [
		0,
		0,
		25,
		25,
		-15
	],
	rcaronntilde: [
		0,
		0,
		25,
		25,
		-15
	],
	rcaronp: [
		0,
		0,
		30,
		30,
		-10
	],
	rcaronsemicolon: [
		0,
		0,
		30,
		30
	],
	rcaronu: [
		0,
		0,
		15,
		15
	],
	rcaronuacute: [
		0,
		0,
		15,
		15
	],
	rcaronucircumflex: [
		0,
		0,
		15,
		15
	],
	rcaronudieresis: [
		0,
		0,
		15,
		15
	],
	rcaronugrave: [
		0,
		0,
		15,
		15
	],
	rcaronuhungarumlaut: [
		0,
		0,
		15,
		15
	],
	rcaronumacron: [
		0,
		0,
		15,
		15
	],
	rcaronuogonek: [
		0,
		0,
		15,
		15
	],
	rcaronuring: [
		0,
		0,
		15,
		15
	],
	rcommaaccenta: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcommaaccentaacute: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcommaaccentabreve: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcommaaccentacircumflex: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcommaaccentadieresis: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcommaaccentagrave: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcommaaccentamacron: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcommaaccentaogonek: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcommaaccentaring: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcommaaccentatilde: [
		0,
		0,
		-10,
		-10,
		0,
		0,
		-15
	],
	rcommaaccentcolon: [
		0,
		0,
		30,
		30
	],
	rcommaaccenti: [
		0,
		0,
		15,
		15
	],
	rcommaaccentiacute: [
		0,
		0,
		15,
		15
	],
	rcommaaccenticircumflex: [
		0,
		0,
		15,
		15
	],
	rcommaaccentidieresis: [
		0,
		0,
		15,
		15
	],
	rcommaaccentigrave: [
		0,
		0,
		15,
		15
	],
	rcommaaccentimacron: [
		0,
		0,
		15,
		15
	],
	rcommaaccentiogonek: [
		0,
		0,
		15,
		15
	],
	rcommaaccentk: [
		0,
		0,
		15,
		15
	],
	rcommaaccentkcommaaccent: [
		0,
		0,
		15,
		15
	],
	rcommaaccentl: [
		0,
		0,
		15,
		15
	],
	rcommaaccentlacute: [
		0,
		0,
		15,
		15
	],
	rcommaaccentlcommaaccent: [
		0,
		0,
		15,
		15
	],
	rcommaaccentlslash: [
		0,
		0,
		15,
		15
	],
	rcommaaccentm: [
		0,
		0,
		25,
		25
	],
	rcommaaccentn: [
		0,
		0,
		25,
		25,
		-15
	],
	rcommaaccentnacute: [
		0,
		0,
		25,
		25,
		-15
	],
	rcommaaccentncaron: [
		0,
		0,
		25,
		25,
		-15
	],
	rcommaaccentncommaaccent: [
		0,
		0,
		25,
		25,
		-15
	],
	rcommaaccentntilde: [
		0,
		0,
		25,
		25,
		-15
	],
	rcommaaccentp: [
		0,
		0,
		30,
		30,
		-10
	],
	rcommaaccentsemicolon: [
		0,
		0,
		30,
		30
	],
	rcommaaccentu: [
		0,
		0,
		15,
		15
	],
	rcommaaccentuacute: [
		0,
		0,
		15,
		15
	],
	rcommaaccentucircumflex: [
		0,
		0,
		15,
		15
	],
	rcommaaccentudieresis: [
		0,
		0,
		15,
		15
	],
	rcommaaccentugrave: [
		0,
		0,
		15,
		15
	],
	rcommaaccentuhungarumlaut: [
		0,
		0,
		15,
		15
	],
	rcommaaccentumacron: [
		0,
		0,
		15,
		15
	],
	rcommaaccentuogonek: [
		0,
		0,
		15,
		15
	],
	rcommaaccenturing: [
		0,
		0,
		15,
		15
	],
	scomma: [
		0,
		0,
		-15,
		-15
	],
	speriod: [
		0,
		0,
		-15,
		-15
	],
	sacutecomma: [
		0,
		0,
		-15,
		-15
	],
	sacuteperiod: [
		0,
		0,
		-15,
		-15
	],
	scaroncomma: [
		0,
		0,
		-15,
		-15
	],
	scaronperiod: [
		0,
		0,
		-15,
		-15
	],
	scedillacomma: [
		0,
		0,
		-15,
		-15
	],
	scedillaperiod: [
		0,
		0,
		-15,
		-15
	],
	scommaaccentcomma: [
		0,
		0,
		-15,
		-15
	],
	scommaaccentperiod: [
		0,
		0,
		-15,
		-15
	],
	ve: [
		0,
		0,
		-25,
		-25,
		-10,
		-15,
		0,
		-15
	],
	veacute: [
		0,
		0,
		-25,
		-25,
		-10,
		-15,
		0,
		-15
	],
	vecaron: [
		0,
		0,
		-25,
		-25,
		-10,
		-15,
		0,
		-15
	],
	vecircumflex: [
		0,
		0,
		-25,
		-25,
		-10,
		-15,
		0,
		-15
	],
	vedieresis: [
		0,
		0,
		-25,
		-25,
		-10,
		-15,
		0,
		-15
	],
	vedotaccent: [
		0,
		0,
		-25,
		-25,
		-10,
		-15,
		0,
		-15
	],
	vegrave: [
		0,
		0,
		-25,
		-25,
		-10,
		-15,
		0,
		-15
	],
	vemacron: [
		0,
		0,
		-25,
		-25,
		-10,
		-15,
		0,
		-15
	],
	veogonek: [
		0,
		0,
		-25,
		-25,
		-10,
		-15,
		0,
		-15
	],
	wa: [
		0,
		0,
		-15,
		-15,
		0,
		-10,
		0,
		-10
	],
	waacute: [
		0,
		0,
		-15,
		-15,
		0,
		-10,
		0,
		-10
	],
	wabreve: [
		0,
		0,
		-15,
		-15,
		0,
		-10,
		0,
		-10
	],
	wacircumflex: [
		0,
		0,
		-15,
		-15,
		0,
		-10,
		0,
		-10
	],
	wadieresis: [
		0,
		0,
		-15,
		-15,
		0,
		-10,
		0,
		-10
	],
	wagrave: [
		0,
		0,
		-15,
		-15,
		0,
		-10,
		0,
		-10
	],
	wamacron: [
		0,
		0,
		-15,
		-15,
		0,
		-10,
		0,
		-10
	],
	waogonek: [
		0,
		0,
		-15,
		-15,
		0,
		-10,
		0,
		-10
	],
	waring: [
		0,
		0,
		-15,
		-15,
		0,
		-10,
		0,
		-10
	],
	watilde: [
		0,
		0,
		-15,
		-15,
		0,
		-10,
		0,
		-10
	],
	we: [
		0,
		0,
		-10,
		-10,
		0,
		-10
	],
	weacute: [
		0,
		0,
		-10,
		-10,
		0,
		-10
	],
	wecaron: [
		0,
		0,
		-10,
		-10,
		0,
		-10
	],
	wecircumflex: [
		0,
		0,
		-10,
		-10,
		0,
		-10
	],
	wedieresis: [
		0,
		0,
		-10,
		-10,
		0,
		-10
	],
	wedotaccent: [
		0,
		0,
		-10,
		-10,
		0,
		-10
	],
	wegrave: [
		0,
		0,
		-10,
		-10,
		0,
		-10
	],
	wemacron: [
		0,
		0,
		-10,
		-10,
		0,
		-10
	],
	weogonek: [
		0,
		0,
		-10,
		-10,
		0,
		-10
	],
	zo: [
		0,
		0,
		-15,
		-15
	],
	zoacute: [
		0,
		0,
		-15,
		-15
	],
	zocircumflex: [
		0,
		0,
		-15,
		-15
	],
	zodieresis: [
		0,
		0,
		-15,
		-15
	],
	zograve: [
		0,
		0,
		-15,
		-15
	],
	zohungarumlaut: [
		0,
		0,
		-15,
		-15
	],
	zomacron: [
		0,
		0,
		-15,
		-15
	],
	zoslash: [
		0,
		0,
		-15,
		-15
	],
	zotilde: [
		0,
		0,
		-15,
		-15
	],
	zacuteo: [
		0,
		0,
		-15,
		-15
	],
	zacuteoacute: [
		0,
		0,
		-15,
		-15
	],
	zacuteocircumflex: [
		0,
		0,
		-15,
		-15
	],
	zacuteodieresis: [
		0,
		0,
		-15,
		-15
	],
	zacuteograve: [
		0,
		0,
		-15,
		-15
	],
	zacuteohungarumlaut: [
		0,
		0,
		-15,
		-15
	],
	zacuteomacron: [
		0,
		0,
		-15,
		-15
	],
	zacuteoslash: [
		0,
		0,
		-15,
		-15
	],
	zacuteotilde: [
		0,
		0,
		-15,
		-15
	],
	zcarono: [
		0,
		0,
		-15,
		-15
	],
	zcaronoacute: [
		0,
		0,
		-15,
		-15
	],
	zcaronocircumflex: [
		0,
		0,
		-15,
		-15
	],
	zcaronodieresis: [
		0,
		0,
		-15,
		-15
	],
	zcaronograve: [
		0,
		0,
		-15,
		-15
	],
	zcaronohungarumlaut: [
		0,
		0,
		-15,
		-15
	],
	zcaronomacron: [
		0,
		0,
		-15,
		-15
	],
	zcaronoslash: [
		0,
		0,
		-15,
		-15
	],
	zcaronotilde: [
		0,
		0,
		-15,
		-15
	],
	zdotaccento: [
		0,
		0,
		-15,
		-15
	],
	zdotaccentoacute: [
		0,
		0,
		-15,
		-15
	],
	zdotaccentocircumflex: [
		0,
		0,
		-15,
		-15
	],
	zdotaccentodieresis: [
		0,
		0,
		-15,
		-15
	],
	zdotaccentograve: [
		0,
		0,
		-15,
		-15
	],
	zdotaccentohungarumlaut: [
		0,
		0,
		-15,
		-15
	],
	zdotaccentomacron: [
		0,
		0,
		-15,
		-15
	],
	zdotaccentoslash: [
		0,
		0,
		-15,
		-15
	],
	zdotaccentotilde: [
		0,
		0,
		-15,
		-15
	],
	Ap: [
		0,
		0,
		0,
		0,
		-25
	],
	Aquoteright: [
		0,
		0,
		0,
		0,
		-74,
		-74,
		-37,
		-111
	],
	Aacutep: [
		0,
		0,
		0,
		0,
		-25
	],
	Aacutequoteright: [
		0,
		0,
		0,
		0,
		-74,
		-74,
		-37,
		-111
	],
	Abrevep: [
		0,
		0,
		0,
		0,
		-25
	],
	Abrevequoteright: [
		0,
		0,
		0,
		0,
		-74,
		-74,
		-37,
		-111
	],
	Acircumflexp: [
		0,
		0,
		0,
		0,
		-25
	],
	Acircumflexquoteright: [
		0,
		0,
		0,
		0,
		-74,
		-74,
		-37,
		-111
	],
	Adieresisp: [
		0,
		0,
		0,
		0,
		-25
	],
	Adieresisquoteright: [
		0,
		0,
		0,
		0,
		-74,
		-74,
		-37,
		-111
	],
	Agravep: [
		0,
		0,
		0,
		0,
		-25
	],
	Agravequoteright: [
		0,
		0,
		0,
		0,
		-74,
		-74,
		-37,
		-111
	],
	Amacronp: [
		0,
		0,
		0,
		0,
		-25
	],
	Amacronquoteright: [
		0,
		0,
		0,
		0,
		-74,
		-74,
		-37,
		-111
	],
	Aogonekp: [
		0,
		0,
		0,
		0,
		-25
	],
	Aogonekquoteright: [
		0,
		0,
		0,
		0,
		-74,
		-74,
		-37,
		-111
	],
	Aringp: [
		0,
		0,
		0,
		0,
		-25
	],
	Aringquoteright: [
		0,
		0,
		0,
		0,
		-74,
		-74,
		-37,
		-111
	],
	Atildep: [
		0,
		0,
		0,
		0,
		-25
	],
	Atildequoteright: [
		0,
		0,
		0,
		0,
		-74,
		-74,
		-37,
		-111
	],
	Je: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jeacute: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jecaron: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jecircumflex: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jedieresis: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jedotaccent: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jegrave: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jemacron: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jeogonek: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jo: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Joacute: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jocircumflex: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jodieresis: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jograve: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Johungarumlaut: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jomacron: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Joslash: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	Jotilde: [
		0,
		0,
		0,
		0,
		-15,
		-40,
		-25
	],
	NA: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NAacute: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NAbreve: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NAcircumflex: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NAdieresis: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NAgrave: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NAmacron: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NAogonek: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NAring: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NAtilde: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NacuteA: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NacuteAacute: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NacuteAbreve: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NacuteAcircumflex: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NacuteAdieresis: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NacuteAgrave: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NacuteAmacron: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NacuteAogonek: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NacuteAring: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NacuteAtilde: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcaronA: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcaronAacute: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcaronAbreve: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcaronAcircumflex: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcaronAdieresis: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcaronAgrave: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcaronAmacron: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcaronAogonek: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcaronAring: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcaronAtilde: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcommaaccentA: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcommaaccentAacute: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcommaaccentAbreve: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcommaaccentAcircumflex: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcommaaccentAdieresis: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcommaaccentAgrave: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcommaaccentAmacron: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcommaaccentAogonek: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcommaaccentAring: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NcommaaccentAtilde: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NtildeA: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NtildeAacute: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NtildeAbreve: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NtildeAcircumflex: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NtildeAdieresis: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NtildeAgrave: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NtildeAmacron: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NtildeAogonek: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NtildeAring: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	NtildeAtilde: [
		0,
		0,
		0,
		0,
		-20,
		-30,
		-27,
		-35
	],
	Ti: [
		0,
		0,
		0,
		0,
		-18,
		-37,
		-55,
		-35
	],
	Tiacute: [
		0,
		0,
		0,
		0,
		-18,
		-37,
		-55,
		-35
	],
	Tiogonek: [
		0,
		0,
		0,
		0,
		-18,
		-37,
		-55,
		-35
	],
	Tcaroni: [
		0,
		0,
		0,
		0,
		-18,
		-37,
		-55,
		-35
	],
	Tcaroniacute: [
		0,
		0,
		0,
		0,
		-18,
		-37,
		-55,
		-35
	],
	Tcaroniogonek: [
		0,
		0,
		0,
		0,
		-18,
		-37,
		-55,
		-35
	],
	Tcommaaccenti: [
		0,
		0,
		0,
		0,
		-18,
		-37,
		-55,
		-35
	],
	Tcommaaccentiacute: [
		0,
		0,
		0,
		0,
		-18,
		-37,
		-55,
		-35
	],
	Tcommaaccentiogonek: [
		0,
		0,
		0,
		0,
		-18,
		-37,
		-55,
		-35
	],
	Vi: [
		0,
		0,
		0,
		0,
		-37,
		-55,
		-74,
		-60
	],
	Viacute: [
		0,
		0,
		0,
		0,
		-37,
		-55,
		-74,
		-60
	],
	Vicircumflex: [
		0,
		0,
		0,
		0,
		-37,
		0,
		-34,
		-20
	],
	Vidieresis: [
		0,
		0,
		0,
		0,
		-37,
		0,
		-34,
		-20
	],
	Vigrave: [
		0,
		0,
		0,
		0,
		-37,
		0,
		-34,
		-20
	],
	Vimacron: [
		0,
		0,
		0,
		0,
		-37,
		0,
		-34,
		-20
	],
	Viogonek: [
		0,
		0,
		0,
		0,
		-37,
		-55,
		-74,
		-60
	],
	Wi: [
		0,
		0,
		0,
		0,
		-18,
		-37,
		-55,
		-40
	],
	Wiacute: [
		0,
		0,
		0,
		0,
		-18,
		-37,
		-55,
		-40
	],
	Wiogonek: [
		0,
		0,
		0,
		0,
		-18,
		-37,
		-55,
		-40
	],
	fi: [
		0,
		0,
		0,
		0,
		-25,
		0,
		-20,
		-20
	],
	gperiod: [
		0,
		0,
		0,
		0,
		-15,
		0,
		-15
	],
	gbreveperiod: [
		0,
		0,
		0,
		0,
		-15,
		0,
		-15
	],
	gcommaaccentperiod: [
		0,
		0,
		0,
		0,
		-15,
		0,
		-15
	],
	iv: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-25
	],
	iacutev: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-25
	],
	icircumflexv: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-25
	],
	idieresisv: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-25
	],
	igravev: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-25
	],
	imacronv: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-25
	],
	iogonekv: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-25
	],
	ky: [
		0,
		0,
		0,
		0,
		-15,
		0,
		-10,
		-15
	],
	kyacute: [
		0,
		0,
		0,
		0,
		-15,
		0,
		-10,
		-15
	],
	kydieresis: [
		0,
		0,
		0,
		0,
		-15,
		0,
		-10,
		-15
	],
	kcommaaccenty: [
		0,
		0,
		0,
		0,
		-15,
		0,
		-10,
		-15
	],
	kcommaaccentyacute: [
		0,
		0,
		0,
		0,
		-15,
		0,
		-10,
		-15
	],
	kcommaaccentydieresis: [
		0,
		0,
		0,
		0,
		-15,
		0,
		-10,
		-15
	],
	quotedblleftA: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quotedblleftAacute: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quotedblleftAbreve: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quotedblleftAcircumflex: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quotedblleftAdieresis: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quotedblleftAgrave: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quotedblleftAmacron: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quotedblleftAogonek: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quotedblleftAring: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quotedblleftAtilde: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quoteleftA: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quoteleftAacute: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quoteleftAbreve: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quoteleftAcircumflex: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quoteleftAdieresis: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quoteleftAgrave: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quoteleftAmacron: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quoteleftAogonek: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quoteleftAring: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	quoteleftAtilde: [
		0,
		0,
		0,
		0,
		-10,
		0,
		0,
		-80
	],
	re: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	reacute: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	recaron: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	recircumflex: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	redieresis: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	redotaccent: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	regrave: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	remacron: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	reogonek: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	racutee: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	racuteeacute: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	racuteecaron: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	racuteecircumflex: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	racuteedieresis: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	racuteedotaccent: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	racuteegrave: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	racuteemacron: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	racuteeogonek: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcarone: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcaroneacute: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcaronecaron: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcaronecircumflex: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcaronedieresis: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcaronedotaccent: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcaronegrave: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcaronemacron: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcaroneogonek: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccente: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccenteacute: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccentecaron: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccentecircumflex: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccentedieresis: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccentedotaccent: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccentegrave: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccentemacron: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	rcommaaccenteogonek: [
		0,
		0,
		0,
		0,
		-18,
		0,
		-37
	],
	spaceA: [
		0,
		0,
		0,
		0,
		-55,
		-37,
		-18,
		-55
	],
	spaceAacute: [
		0,
		0,
		0,
		0,
		-55,
		-37,
		-18,
		-55
	],
	spaceAbreve: [
		0,
		0,
		0,
		0,
		-55,
		-37,
		-18,
		-55
	],
	spaceAcircumflex: [
		0,
		0,
		0,
		0,
		-55,
		-37,
		-18,
		-55
	],
	spaceAdieresis: [
		0,
		0,
		0,
		0,
		-55,
		-37,
		-18,
		-55
	],
	spaceAgrave: [
		0,
		0,
		0,
		0,
		-55,
		-37,
		-18,
		-55
	],
	spaceAmacron: [
		0,
		0,
		0,
		0,
		-55,
		-37,
		-18,
		-55
	],
	spaceAogonek: [
		0,
		0,
		0,
		0,
		-55,
		-37,
		-18,
		-55
	],
	spaceAring: [
		0,
		0,
		0,
		0,
		-55,
		-37,
		-18,
		-55
	],
	spaceAtilde: [
		0,
		0,
		0,
		0,
		-55,
		-37,
		-18,
		-55
	],
	Fi: [
		0,
		0,
		0,
		0,
		0,
		-40,
		-45
	],
	Fiacute: [
		0,
		0,
		0,
		0,
		0,
		-40,
		-45
	],
	Ficircumflex: [
		0,
		0,
		0,
		0,
		0,
		-40,
		-45
	],
	Fidieresis: [
		0,
		0,
		0,
		0,
		0,
		-40,
		-45
	],
	Figrave: [
		0,
		0,
		0,
		0,
		0,
		-40,
		-45
	],
	Fimacron: [
		0,
		0,
		0,
		0,
		0,
		-40,
		-45
	],
	Fiogonek: [
		0,
		0,
		0,
		0,
		0,
		-40,
		-45
	],
	eb: [
		0,
		0,
		0,
		0,
		0,
		-10
	],
	eacuteb: [
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ecaronb: [
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ecircumflexb: [
		0,
		0,
		0,
		0,
		0,
		-10
	],
	edieresisb: [
		0,
		0,
		0,
		0,
		0,
		-10
	],
	edotaccentb: [
		0,
		0,
		0,
		0,
		0,
		-10
	],
	egraveb: [
		0,
		0,
		0,
		0,
		0,
		-10
	],
	emacronb: [
		0,
		0,
		0,
		0,
		0,
		-10
	],
	eogonekb: [
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ff: [
		0,
		0,
		0,
		0,
		0,
		-18,
		-18,
		-25
	],
	quoterightt: [
		0,
		0,
		0,
		0,
		0,
		-37,
		-30,
		-18
	],
	quoterighttcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		-37,
		-30,
		-18
	],
	Yicircumflex: [
		0,
		0,
		0,
		0,
		0,
		0,
		-34
	],
	Yidieresis: [
		0,
		0,
		0,
		0,
		0,
		0,
		-34
	],
	Yigrave: [
		0,
		0,
		0,
		0,
		0,
		0,
		-34
	],
	Yimacron: [
		0,
		0,
		0,
		0,
		0,
		0,
		-34
	],
	Yacuteicircumflex: [
		0,
		0,
		0,
		0,
		0,
		0,
		-34
	],
	Yacuteidieresis: [
		0,
		0,
		0,
		0,
		0,
		0,
		-34
	],
	Yacuteigrave: [
		0,
		0,
		0,
		0,
		0,
		0,
		-34
	],
	Yacuteimacron: [
		0,
		0,
		0,
		0,
		0,
		0,
		-34
	],
	Ydieresisicircumflex: [
		0,
		0,
		0,
		0,
		0,
		0,
		-34
	],
	Ydieresisidieresis: [
		0,
		0,
		0,
		0,
		0,
		0,
		-34
	],
	Ydieresisigrave: [
		0,
		0,
		0,
		0,
		0,
		0,
		-34
	],
	Ydieresisimacron: [
		0,
		0,
		0,
		0,
		0,
		0,
		-34
	],
	eg: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	egbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	egcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	eacuteg: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	eacutegbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	eacutegcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	ecarong: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	ecarongbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	ecarongcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	ecircumflexg: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	ecircumflexgbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	ecircumflexgcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	edieresisg: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	edieresisgbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	edieresisgcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	edotaccentg: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	edotaccentgbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	edotaccentgcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	egraveg: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	egravegbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	egravegcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	emacrong: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	emacrongbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	emacrongcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	eogonekg: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	eogonekgbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	eogonekgcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-40,
		-15
	],
	fiogonek: [
		0,
		0,
		0,
		0,
		0,
		0,
		-20
	],
	gcomma: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	gbrevecomma: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	gcommaaccentcomma: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	og: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ogbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ogcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	oacuteg: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	oacutegbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	oacutegcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ocircumflexg: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ocircumflexgbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ocircumflexgcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	odieresisg: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	odieresisgbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	odieresisgcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ograveg: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ogravegbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ogravegcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ohungarumlautg: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ohungarumlautgbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	ohungarumlautgcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	omacrong: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	omacrongbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	omacrongcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	otildeg: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	otildegbreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	otildegcommaaccent: [
		0,
		0,
		0,
		0,
		0,
		0,
		-10
	],
	fiacute: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-20
	],
	ga: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gaacute: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gabreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gacircumflex: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gadieresis: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gagrave: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gamacron: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gaogonek: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	garing: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gatilde: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gbrevea: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gbreveaacute: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gbreveabreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gbreveacircumflex: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gbreveadieresis: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gbreveagrave: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gbreveamacron: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gbreveaogonek: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gbrevearing: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gbreveatilde: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gcommaaccenta: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gcommaaccentaacute: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gcommaaccentabreve: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gcommaaccentacircumflex: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gcommaaccentadieresis: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gcommaaccentagrave: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gcommaaccentamacron: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gcommaaccentaogonek: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gcommaaccentaring: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	],
	gcommaaccentatilde: [
		0,
		0,
		0,
		0,
		0,
		0,
		0,
		-5
	]
};
var data = {
	attributes: attributes,
	glyphWidths: glyphWidths,
	kernPairs: kernPairs
};

const initFont = font => {
  return [font.FontName, {
    attributes: font,
    glyphWidths: {},
    kernPairs: {}
  }];
};
const expandData = data => {
  const {
    attributes,
    glyphWidths,
    kernPairs
  } = data;
  const fonts = attributes.map(initFont);
  Object.keys(glyphWidths).forEach(key => {
    glyphWidths[key].forEach((value, index) => {
      if (value) fonts[index][1].glyphWidths[key] = value;
    });
  });
  Object.keys(kernPairs).forEach(key => {
    kernPairs[key].forEach((value, index) => {
      if (value) fonts[index][1].kernPairs[key] = value;
    });
  });
  return Object.fromEntries(fonts);
};

const STANDARD_FONTS = expandData(data);
const createStandardFont = PDFFont => class StandardFont extends PDFFont {
  constructor(document, name, id) {
    super();
    this.document = document;
    this.name = name;
    this.id = id;
    this.font = AFMFont.fromJson(STANDARD_FONTS[this.name]);
    this.ascender = this.font.ascender;
    this.descender = this.font.descender;
    this.bbox = this.font.bbox;
    this.lineGap = this.font.lineGap;
  }
  embed() {
    this.dictionary.data = {
      Type: 'Font',
      BaseFont: this.name,
      Subtype: 'Type1',
      Encoding: 'WinAnsiEncoding'
    };
    return this.dictionary.end();
  }
  encode(text) {
    const encoded = this.font.encodeText(text);
    const glyphs = this.font.glyphsForString(`${text}`);
    const advances = this.font.advancesForGlyphs(glyphs);
    const positions = [];
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];
      positions.push({
        xAdvance: advances[i],
        yAdvance: 0,
        xOffset: 0,
        yOffset: 0,
        advanceWidth: this.font.widthOfGlyph(glyph)
      });
    }
    return [encoded, positions];
  }
  encodeGlyphs(glyphs) {
    const res = [];
    for (let glyph of Array.from(glyphs)) {
      res.push(`00${glyph.id.toString(16)}`.slice(-2));
    }
    return res;
  }
  widthOfString(string, size) {
    const glyphs = this.font.glyphsForString(`${string}`);
    const advances = this.font.advancesForGlyphs(glyphs);
    let width = 0;
    for (let advance of Array.from(advances)) {
      width += advance;
    }
    const scale = size / 1000;
    return width * scale;
  }
  static isStandardFont(name) {
    return name in STANDARD_FONTS;
  }
};

const toHex = function () {
  for (var _len = arguments.length, codePoints = new Array(_len), _key = 0; _key < _len; _key++) {
    codePoints[_key] = arguments[_key];
  }
  const codes = Array.from(codePoints).map(code => `0000${code.toString(16)}`.slice(-4));
  return codes.join('');
};
const createEmbeddedFont = PDFFont => class EmbeddedFont extends PDFFont {
  constructor(document, font, id) {
    super();
    this.document = document;
    this.font = font;
    this.id = id;
    this.subset = this.font.createSubset();
    this.unicode = [[0]];
    this.widths = [this.font.getGlyph(0).advanceWidth];
    this.name = this.font.postscriptName;
    this.scale = 1000 / this.font.unitsPerEm;
    this.ascender = this.font.ascent * this.scale;
    this.descender = this.font.descent * this.scale;
    this.xHeight = this.font.xHeight * this.scale;
    this.capHeight = this.font.capHeight * this.scale;
    this.lineGap = this.font.lineGap * this.scale;
    this.bbox = this.font.bbox;
    this.layoutCache = Object.create(null);
  }
  layoutRun(text, features) {
    // passing LTR To force fontkit to not reverse the string
    const run = this.font.layout(text, features, undefined, undefined, 'ltr');

    // Normalize position values
    for (let i = 0; i < run.positions.length; i++) {
      const position = run.positions[i];
      for (let key in position) {
        position[key] *= this.scale;
      }
      position.advanceWidth = run.glyphs[i].advanceWidth * this.scale;
    }
    return run;
  }
  layoutCached(text) {
    let cached;
    if (cached = this.layoutCache[text]) {
      return cached;
    }
    const run = this.layoutRun(text);
    this.layoutCache[text] = run;
    return run;
  }
  layout(text, features, onlyWidth) {
    // Skip the cache if any user defined features are applied
    if (onlyWidth == null) {
      onlyWidth = false;
    }
    if (features) {
      return this.layoutRun(text, features);
    }
    const glyphs = onlyWidth ? null : [];
    const positions = onlyWidth ? null : [];
    let advanceWidth = 0;

    // Split the string by words to increase cache efficiency.
    // For this purpose, spaces and tabs are a good enough delimeter.
    let last = 0;
    let index = 0;
    while (index <= text.length) {
      let needle;
      if (index === text.length && last < index || (needle = text.charAt(index), [' ', '\t'].includes(needle))) {
        const run = this.layoutCached(text.slice(last, ++index));
        if (!onlyWidth) {
          glyphs.push(...Array.from(run.glyphs || []));
          positions.push(...Array.from(run.positions || []));
        }
        advanceWidth += run.advanceWidth;
        last = index;
      } else {
        index++;
      }
    }
    return {
      glyphs,
      positions,
      advanceWidth
    };
  }
  encode(text, features) {
    const {
      glyphs,
      positions
    } = this.layout(text, features);
    const res = [];
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];
      const gid = this.subset.includeGlyph(glyph.id);
      res.push(`0000${gid.toString(16)}`.slice(-4));
      if (this.widths[gid] == null) {
        this.widths[gid] = glyph.advanceWidth * this.scale;
      }
      if (this.unicode[gid] == null) {
        this.unicode[gid] = glyph.codePoints;
      }
    }
    return [res, positions];
  }
  encodeGlyphs(glyphs) {
    const res = [];
    for (let i = 0; i < glyphs.length; i++) {
      const glyph = glyphs[i];
      const gid = this.subset.includeGlyph(glyph.id);
      res.push(`0000${gid.toString(16)}`.slice(-4));
      if (this.widths[gid] == null) {
        this.widths[gid] = glyph.advanceWidth * this.scale;
      }
      if (this.unicode[gid] == null) {
        this.unicode[gid] = glyph.codePoints;
      }
    }
    return res;
  }
  widthOfString(string, size, features) {
    const width = this.layout(string, features, true).advanceWidth;
    const scale = size / 1000;
    return width * scale;
  }
  embed() {
    const isCFF = this.subset.cff != null;
    const fontFile = this.document.ref();
    if (isCFF) {
      fontFile.data.Subtype = 'CIDFontType0C';
    }
    fontFile.end(this.subset.encode());
    const familyClass = ((this.font['OS/2'] != null ? this.font['OS/2'].sFamilyClass : undefined) || 0) >> 8;
    let flags = 0;
    if (this.font.post.isFixedPitch) {
      flags |= 1 << 0;
    }
    if (1 <= familyClass && familyClass <= 7) {
      flags |= 1 << 1;
    }
    flags |= 1 << 2; // assume the font uses non-latin characters
    if (familyClass === 10) {
      flags |= 1 << 3;
    }
    if (this.font.head.macStyle.italic) {
      flags |= 1 << 6;
    }

    // generate a random tag (6 uppercase letters. 65 is the char code for 'A')
    const tag = [0, 1, 2, 3, 4, 5].map(() => String.fromCharCode(Math.random() * 26 + 65)).join('');
    const name = tag + '+' + this.font.postscriptName;
    const {
      bbox
    } = this.font;
    const descriptor = this.document.ref({
      Type: 'FontDescriptor',
      FontName: name,
      Flags: flags,
      FontBBox: [bbox.minX * this.scale, bbox.minY * this.scale, bbox.maxX * this.scale, bbox.maxY * this.scale],
      ItalicAngle: this.font.italicAngle,
      Ascent: this.ascender,
      Descent: this.descender,
      CapHeight: (this.font.capHeight || this.font.ascent) * this.scale,
      XHeight: (this.font.xHeight || 0) * this.scale,
      StemV: 0
    }); // not sure how to calculate this

    if (isCFF) {
      descriptor.data.FontFile3 = fontFile;
    } else {
      descriptor.data.FontFile2 = fontFile;
    }
    descriptor.end();
    const descendantFontData = {
      Type: 'Font',
      Subtype: 'CIDFontType0',
      BaseFont: name,
      CIDSystemInfo: {
        Registry: new String('Adobe'),
        Ordering: new String('Identity'),
        Supplement: 0
      },
      FontDescriptor: descriptor,
      W: [0, this.widths]
    };
    if (!isCFF) {
      descendantFontData.Subtype = 'CIDFontType2';
      descendantFontData.CIDToGIDMap = 'Identity';
    }
    const descendantFont = this.document.ref(descendantFontData);
    descendantFont.end();
    this.dictionary.data = {
      Type: 'Font',
      Subtype: 'Type0',
      BaseFont: name,
      Encoding: 'Identity-H',
      DescendantFonts: [descendantFont],
      ToUnicode: this.toUnicodeCmap()
    };
    return this.dictionary.end();
  }

  // Maps the glyph ids encoded in the PDF back to unicode strings
  // Because of ligature substitutions and the like, there may be one or more
  // unicode characters represented by each glyph.
  toUnicodeCmap() {
    const cmap = this.document.ref();
    let entries = [];
    let unicodeMap = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo <<\n  /Registry (Adobe)\n  /Ordering (UCS)\n  /Supplement 0\n>> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000><ffff>\nendcodespacerange';
    for (let [index, codePoints] of this.unicode.entries()) {
      const encoded = [];
      if (entries.length >= 100) {
        unicodeMap += '\n' + entries.length + ' beginbfchar\n' + entries.join('\n') + '\nendbfchar';
        entries = [];
      }
      // encode codePoints to utf16
      for (let value of codePoints) {
        if (value > 0xffff) {
          value -= 0x10000;
          encoded.push(toHex(value >>> 10 & 0x3ff | 0xd800));
          value = 0xdc00 | value & 0x3ff;
        }
        encoded.push(toHex(value));
      }

      // eslint-disable-next-line no-useless-concat
      entries.push('<' + toHex(index) + '>' + '<' + encoded.join(' ') + '>');
    }
    if (entries.length) {
      unicodeMap += '\n' + entries.length + ' beginbfchar\n' + entries.join('\n') + '\nendbfchar\n';
    }
    unicodeMap += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
    cmap.end(unicodeMap);
    return cmap;
  }
};

class PDFFont {
  static open(document, src, family, id) {
    let font;
    if (typeof src === 'string') {
      if (StandardFont.isStandardFont(src)) {
        return new StandardFont(document, src, id);
      }
      {
        throw new Error(`Can't open ${src} in browser build`);
      }
    } else if (src instanceof Uint8Array) {
      font = fontkit.create(src, family);
    } else if (src instanceof ArrayBuffer) {
      font = fontkit.create(new Uint8Array(src), family);
    } else if (typeof src === 'object') {
      font = src;
    }
    if (font == null) {
      throw new Error('Not a supported font format or standard PDF font.');
    }
    return new EmbeddedFont(document, font, id);
  }
  encode() {
    throw new Error('Must be implemented by subclasses');
  }
  widthOfString() {
    throw new Error('Must be implemented by subclasses');
  }
  ref() {
    return this.dictionary != null ? this.dictionary : this.dictionary = this.document.ref();
  }
  finalize() {
    if (this.embedded || this.dictionary == null) {
      return;
    }
    this.embed();
    return this.embedded = true;
  }
  embed() {
    throw new Error('Must be implemented by subclasses');
  }
  lineHeight(size, includeGap) {
    if (includeGap == null) {
      includeGap = false;
    }
    const gap = includeGap ? this.lineGap : 0;
    return (this.ascender + gap - this.descender) / 1000 * size;
  }
}
const StandardFont = createStandardFont(PDFFont);
const EmbeddedFont = createEmbeddedFont(PDFFont);

var FontsMixin = {
  initFonts() {
    // Lookup table for embedded fonts
    this._fontFamilies = {};
    this._fontCount = 0;

    // Font state
    this._fontSize = 12;
    this._font = null;
    this._registeredFonts = {};

    // Set the default font
    return this.font('Helvetica');
  },
  font(src, family, size) {
    let cacheKey;
    let font;
    if (typeof family === 'number') {
      size = family;
      family = null;
    }

    // check registered fonts if src is a string
    if (typeof src === 'string' && this._registeredFonts[src]) {
      cacheKey = src;
      ({
        src,
        family
      } = this._registeredFonts[src]);
    } else {
      cacheKey = family || src;
      if (typeof cacheKey !== 'string') {
        cacheKey = null;
      }
    }
    if (size != null) {
      this.fontSize(size);
    }

    // fast path: check if the font is already in the PDF
    if (font = this._fontFamilies[cacheKey]) {
      this._font = font;
      return this;
    }

    // load the font
    const id = `F${++this._fontCount}`;
    this._font = PDFFont.open(this, src, family, id);

    // check for existing font familes with the same name already in the PDF
    // useful if the font was passed as a buffer
    if (font = this._fontFamilies[this._font.name]) {
      this._font = font;
      return this;
    }

    // save the font for reuse later
    if (cacheKey) {
      this._fontFamilies[cacheKey] = this._font;
    }
    if (this._font.name) {
      this._fontFamilies[this._font.name] = this._font;
    }
    return this;
  },
  fontSize(_fontSize) {
    this._fontSize = _fontSize;
    return this;
  },
  currentLineHeight(includeGap) {
    if (includeGap == null) {
      includeGap = false;
    }
    return this._font.lineHeight(this._fontSize, includeGap);
  },
  registerFont(name, src, family) {
    this._registeredFonts[name] = {
      src,
      family
    };
    return this;
  }
};

const {
  number
} = PDFObject$1;
var TextMixin = {
  initText() {
    this._line = this._line.bind(this);

    // Current coordinates
    this.x = 0;
    this.y = 0;
    return this._lineGap = 0;
  },
  _text(text, x, y, options, lineCallback) {
    options = this._initOptions(x, y, options);

    // Convert text to a string
    text = text == null ? '' : `${text}`;

    // if the wordSpacing option is specified, remove multiple consecutive spaces
    if (options.wordSpacing) {
      text = text.replace(/\s{2,}/g, ' ');
    }
    const addStructure = () => {
      if (options.structParent) {
        options.structParent.add(this.struct(options.structType || 'P', [this.markStructureContent(options.structType || 'P')]));
      }
    };
    for (let line of text.split('\n')) {
      addStructure();
      lineCallback(line, options);
    }
    return this;
  },
  text(text, x, y, options) {
    return this._text(text, x, y, options, this._line);
  },
  widthOfString(string, options) {
    if (options === void 0) {
      options = {};
    }
    return this._font.widthOfString(string, this._fontSize, options.features) + (options.characterSpacing || 0) * (string.length - 1);
  },
  _initOptions(x, y, options) {
    if (x === void 0) {
      x = {};
    }
    if (options === void 0) {
      options = {};
    }
    if (typeof x === 'object') {
      options = x;
      x = null;
    }

    // shallow clone options object
    /**
     * @type {Object}
     */
    const result = Object.assign({}, options);

    // extend options with previous values for continued text
    if (this._textOptions) {
      for (let key in this._textOptions) {
        const val = this._textOptions[key];
        if (key !== 'continued') {
          if (result[key] === undefined) {
            result[key] = val;
          }
        }
      }
    }

    // Update the current position
    if (x != null) {
      this.x = x;
    }
    if (y != null) {
      this.y = y;
    }

    // wrap to margins if no x or y position passed
    if (result.lineBreak !== false) {
      if (result.width == null) {
        result.width = this.page.width - this.x - this.page.margins.right;
      }
      result.width = Math.max(result.width, 0);
    }
    if (!result.columns) {
      result.columns = 0;
    }
    if (result.columnGap == null) {
      result.columnGap = 18;
    } // 1/4 inch

    return result;
  },
  _line(text, options) {
    if (options === void 0) {
      options = {};
    }
    this._fragment(text, this.x, this.y, options);
    return this.x += this.widthOfString(text);
  },
  _fragment(text, x, y, options) {
    text = `${text}`.replace(/\n/g, '');
    if (text.length === 0) return;
    const [encoded, positions] = this._font.encode(text, options.features);
    const dy = this._font.ascender / 1000 * this._fontSize;
    this._glyphs(encoded, positions, x, y + dy, options);
  },
  _glyphs(encoded, positions, x, y, options) {
    const commands = [];
    const scale = this._fontSize / 1000;
    let i;
    let last = 0;
    let hadOffset = false;
    this.save();

    // flip coordinate system
    this.transform(1, 0, 0, -1, 0, this.page.height);
    y = this.page.height - y;

    // add current font to page if necessary
    if (this.page.fonts[this._font.id] == null) {
      this.page.fonts[this._font.id] = this._font.ref();
    }

    // begin the text object
    this.addContent('BT');

    // text position
    this.addContent(`1 0 0 1 ${number(x)} ${number(y)} Tm`);

    // font and font size
    this.addContent(`/${this._font.id} ${number(this._fontSize)} Tf`);

    // rendering mode
    const mode = options.fill && options.stroke ? 2 : options.stroke ? 1 : 0;
    if (mode) {
      this.addContent(`${mode} Tr`);
    }

    // Adds a segment of text to the TJ command buffer
    const addSegment = cur => {
      if (last < cur) {
        const hex = encoded.slice(last, cur).join('');
        const advance = positions[cur - 1].xAdvance - positions[cur - 1].advanceWidth;
        commands.push(`<${hex}> ${number(-advance)}`);
      }
      return last = cur;
    };

    // Flushes the current TJ commands to the output stream
    const flush = i => {
      addSegment(i);
      if (commands.length > 0) {
        this.addContent(`[${commands.join(' ')}] TJ`);
        return commands.length = 0;
      }
    };
    for (i = 0; i < positions.length; i++) {
      // If we have an x or y offset, we have to break out of the current TJ command
      // so we can move the text position.
      const pos = positions[i];
      if (pos.xOffset || pos.yOffset) {
        // Flush the current buffer
        flush(i);

        // Move the text position and flush just the current character
        this.addContent(`1 0 0 1 ${number(x + pos.xOffset * scale)} ${number(y + pos.yOffset * scale)} Tm`);
        flush(i + 1);
        hadOffset = true;
      } else {
        // If the last character had an offset, reset the text position
        if (hadOffset) {
          this.addContent(`1 0 0 1 ${number(x)} ${number(y)} Tm`);
          hadOffset = false;
        }

        // Group segments that don't have any advance adjustments
        if (pos.xAdvance - pos.advanceWidth !== 0) {
          addSegment(i + 1);
        }
      }
      x += pos.xAdvance * scale;
    }

    // Flush any remaining commands
    flush(i);

    // end the text object
    this.addContent('ET');

    // restore flipped coordinate system
    return this.restore();
  }
};

const COLOR_SPACE_MAP = {
  1: 'DeviceGray',
  3: 'DeviceRGB',
  4: 'DeviceCMYK'
};
class JPEG {
  constructor(data, label) {
    this.data = data;
    this.label = label;
    this.orientation = 1;
    if (this.data.readUInt16BE(0) !== 0xffd8) {
      throw 'SOI not found in JPEG';
    }
    const markers = _JPEG.decode(this.data);
    for (let i = 0; i < markers.length; i += 1) {
      const marker = markers[i];
      if (marker.name === 'EXIF' && marker.entries.orientation) {
        this.orientation = marker.entries.orientation;
      }
      if (marker.name === 'SOF') {
        this.bits ||= marker.precision;
        this.width ||= marker.width;
        this.height ||= marker.height;
        this.colorSpace ||= COLOR_SPACE_MAP[marker.numberOfComponents];
      }
    }
    this.obj = null;
  }
  embed(document) {
    if (this.obj) {
      return;
    }
    this.obj = document.ref({
      Type: 'XObject',
      Subtype: 'Image',
      BitsPerComponent: this.bits,
      Width: this.width,
      Height: this.height,
      ColorSpace: this.colorSpace,
      Filter: 'DCTDecode'
    });

    // add extra decode params for CMYK images. By swapping the
    // min and max values from the default, we invert the colors. See
    // section 4.8.4 of the spec.
    if (this.colorSpace === 'DeviceCMYK') {
      this.obj.data['Decode'] = [1.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, 0.0];
    }
    this.obj.end(this.data);

    // free memory
    return this.data = null;
  }
}

class PNGImage {
  constructor(data, label) {
    this.label = label;
    this.image = new PNG(data);
    this.width = this.image.width;
    this.height = this.image.height;
    this.imgData = this.image.imgData;
    this.obj = null;
  }
  embed(document) {
    let dataDecoded = false;
    this.document = document;
    if (this.obj) {
      return;
    }
    const hasAlphaChannel = this.image.hasAlphaChannel;
    const isInterlaced = this.image.interlaceMethod === 1;
    this.obj = this.document.ref({
      Type: 'XObject',
      Subtype: 'Image',
      BitsPerComponent: hasAlphaChannel ? 8 : this.image.bits,
      Width: this.width,
      Height: this.height,
      Filter: 'FlateDecode'
    });
    if (!hasAlphaChannel) {
      const params = this.document.ref({
        Predictor: isInterlaced ? 1 : 15,
        Colors: this.image.colors,
        BitsPerComponent: this.image.bits,
        Columns: this.width
      });
      this.obj.data.DecodeParms = params;
      params.end();
    }
    if (this.image.palette.length === 0) {
      this.obj.data.ColorSpace = this.image.colorSpace;
    } else {
      // embed the color palette in the PDF as an object stream
      const palette = this.document.ref();
      palette.end(Buffer$2.from(this.image.palette));

      // build the color space array for the image
      this.obj.data.ColorSpace = ['Indexed', 'DeviceRGB', this.image.palette.length / 3 - 1, palette];
    }

    // For PNG color types 0, 2 and 3, the transparency data is stored in
    // a dedicated PNG chunk.
    if (this.image.transparency.grayscale != null) {
      // Use Color Key Masking (spec section 4.8.5)
      // An array with N elements, where N is two times the number of color components.
      const val = this.image.transparency.grayscale;
      this.obj.data.Mask = [val, val];
    } else if (this.image.transparency.rgb) {
      // Use Color Key Masking (spec section 4.8.5)
      // An array with N elements, where N is two times the number of color components.
      const {
        rgb
      } = this.image.transparency;
      const mask = [];
      for (let x of rgb) {
        mask.push(x, x);
      }
      this.obj.data.Mask = mask;
    } else if (this.image.transparency.indexed) {
      // Create a transparency SMask for the image based on the data
      // in the PLTE and tRNS sections. See below for details on SMasks.
      dataDecoded = true;
      return this.loadIndexedAlphaChannel();
    } else if (hasAlphaChannel) {
      // For PNG color types 4 and 6, the transparency data is stored as a alpha
      // channel mixed in with the main image data. Separate this data out into an
      // SMask object and store it separately in the PDF.
      dataDecoded = true;
      return this.splitAlphaChannel();
    }
    if (isInterlaced && !dataDecoded) {
      return this.decodeData();
    }
    this.finalize();
  }
  finalize() {
    if (this.alphaChannel) {
      const sMask = this.document.ref({
        Type: 'XObject',
        Subtype: 'Image',
        Height: this.height,
        Width: this.width,
        BitsPerComponent: 8,
        Filter: 'FlateDecode',
        ColorSpace: 'DeviceGray',
        Decode: [0, 1]
      });
      sMask.end(this.alphaChannel);
      this.obj.data.SMask = sMask;
    }

    // add the actual image data
    this.obj.end(this.imgData);

    // free memory
    this.image = null;
    return this.imgData = null;
  }
  splitAlphaChannel() {
    return this.image.decodePixels(pixels => {
      let a;
      let p;
      const colorCount = this.image.colors;
      const pixelCount = this.width * this.height;
      const imgData = Buffer$2.alloc(pixelCount * colorCount);
      const alphaChannel = Buffer$2.alloc(pixelCount);
      let i = p = a = 0;
      const len = pixels.length;
      // For 16bit images copy only most significant byte (MSB) - PNG data is always stored in network byte order (MSB first)
      const skipByteCount = this.image.bits === 16 ? 1 : 0;
      while (i < len) {
        for (let colorIndex = 0; colorIndex < colorCount; colorIndex++) {
          imgData[p++] = pixels[i++];
          i += skipByteCount;
        }
        alphaChannel[a++] = pixels[i++];
        i += skipByteCount;
      }
      this.imgData = zlib.deflateSync(imgData);
      this.alphaChannel = zlib.deflateSync(alphaChannel);
      return this.finalize();
    });
  }
  loadIndexedAlphaChannel() {
    const transparency = this.image.transparency.indexed;
    return this.image.decodePixels(pixels => {
      const alphaChannel = Buffer$2.alloc(this.width * this.height);
      let i = 0;
      for (let j = 0, end = pixels.length; j < end; j++) {
        alphaChannel[i++] = transparency[pixels[j]];
      }
      this.alphaChannel = zlib.deflateSync(alphaChannel);
      return this.finalize();
    });
  }
  decodeData() {
    this.image.decodePixels(pixels => {
      this.imgData = zlib.deflateSync(pixels);
      this.finalize();
    });
  }
}

class PDFImage {
  static open(src, label) {
    let data;
    if (Buffer$2.isBuffer(src)) {
      data = src;
    } else if (src instanceof ArrayBuffer) {
      data = Buffer$2.from(new Uint8Array(src));
    } else {
      let match;
      if (match = /^data:.+?;base64,(.*)$/.exec(src)) {
        data = Buffer$2.from(match[1], 'base64');
      } else {
        data = fs.readFileSync(src);
        if (!data) {
          return;
        }
      }
    }
    if (data[0] === 0xff && data[1] === 0xd8) {
      return new JPEG(data, label);
    } else if (data[0] === 0x89 && data.toString('ascii', 1, 4) === 'PNG') {
      return new PNGImage(data, label);
    } else {
      throw new Error('Unknown image format.');
    }
  }
}

var ImagesMixin = {
  initImages() {
    this._imageRegistry = {};
    return this._imageCount = 0;
  },
  embedImage(src) {
    let image;
    if (typeof src === 'string') {
      image = this._imageRegistry[src];
    }
    if (!image) {
      if (src.width && src.height) {
        image = src;
      } else {
        image = this.openImage(src);
      }
    }
    if (!image.obj) {
      image.embed(this);
    }
    return image;
  },
  image(src, x, y, options) {
    if (options === void 0) {
      options = {};
    }
    let bh;
    let bp;
    let bw;
    let image;
    let ip;
    let left;
    let left1;
    let rotateAngle;
    let originX;
    let originY;
    if (typeof x === 'object') {
      options = x;
      x = null;
    }

    // Ignore orientation based on document options or image options
    const ignoreOrientation = options.ignoreOrientation || options.ignoreOrientation !== false && this.options.ignoreOrientation;
    x = (left = x != null ? x : options.x) != null ? left : this.x;
    y = (left1 = y != null ? y : options.y) != null ? left1 : this.y;
    if (typeof src === 'string') {
      image = this._imageRegistry[src];
    }
    if (!image) {
      if (src.width && src.height) {
        image = src;
      } else {
        image = this.openImage(src);
      }
    }
    if (!image.obj) {
      image.embed(this);
    }
    if (this.page.xobjects[image.label] == null) {
      this.page.xobjects[image.label] = image.obj;
    }
    let {
      width,
      height
    } = image;

    // If EXIF orientation calls for it, swap width and height
    if (!ignoreOrientation && image.orientation > 4) {
      [width, height] = [height, width];
    }
    let w = options.width || width;
    let h = options.height || height;
    if (options.width && !options.height) {
      const wp = w / width;
      w = width * wp;
      h = height * wp;
    } else if (options.height && !options.width) {
      const hp = h / height;
      w = width * hp;
      h = height * hp;
    } else if (options.scale) {
      w = width * options.scale;
      h = height * options.scale;
    } else if (options.fit) {
      [bw, bh] = options.fit;
      bp = bw / bh;
      ip = width / height;
      if (ip > bp) {
        w = bw;
        h = bw / ip;
      } else {
        h = bh;
        w = bh * ip;
      }
    } else if (options.cover) {
      [bw, bh] = options.cover;
      bp = bw / bh;
      ip = width / height;
      if (ip > bp) {
        h = bh;
        w = bh * ip;
      } else {
        w = bw;
        h = bw / ip;
      }
    }
    if (options.fit || options.cover) {
      if (options.align === 'center') {
        x = x + bw / 2 - w / 2;
      } else if (options.align === 'right') {
        x = x + bw - w;
      }
      if (options.valign === 'center') {
        y = y + bh / 2 - h / 2;
      } else if (options.valign === 'bottom') {
        y = y + bh - h;
      }
    }
    if (!ignoreOrientation) {
      switch (image.orientation) {
        // No orientation (need to flip image, though, because of the default transform matrix on the document)
        default:
        case 1:
          h = -h;
          y -= h;
          rotateAngle = 0;
          break;
        // Flip Horizontal
        case 2:
          w = -w;
          h = -h;
          x -= w;
          y -= h;
          rotateAngle = 0;
          break;
        // Rotate 180 degrees
        case 3:
          originX = x;
          originY = y;
          h = -h;
          x -= w;
          rotateAngle = 180;
          break;
        // Flip vertical
        case 4:
          // Do nothing, image will be flipped

          break;
        // Flip horizontally and rotate 270 degrees CW
        case 5:
          originX = x;
          originY = y;
          [w, h] = [h, w];
          y -= h;
          rotateAngle = 90;
          break;
        // Rotate 90 degrees CW
        case 6:
          originX = x;
          originY = y;
          [w, h] = [h, w];
          h = -h;
          rotateAngle = 90;
          break;
        // Flip horizontally and rotate 90 degrees CW
        case 7:
          originX = x;
          originY = y;
          [w, h] = [h, w];
          h = -h;
          w = -w;
          x -= w;
          rotateAngle = 90;
          break;
        // Rotate 270 degrees CW
        case 8:
          originX = x;
          originY = y;
          [w, h] = [h, w];
          h = -h;
          x -= w;
          y -= h;
          rotateAngle = -90;
          break;
      }
    } else {
      h = -h;
      y -= h;
      rotateAngle = 0;
    }

    // Set the current y position to below the image if it is in the document flow
    if (this.y === y) {
      this.y += h;
    }
    this.save();
    if (rotateAngle) {
      this.rotate(rotateAngle, {
        origin: [originX, originY]
      });
    }
    this.transform(w, 0, 0, h, x, y);
    this.addContent(`/${image.label} Do`);
    this.restore();
    return this;
  },
  openImage(src) {
    let image;
    if (typeof src === 'string') {
      image = this._imageRegistry[src];
    }
    if (!image) {
      image = PDFImage.open(src, `I${++this._imageCount}`);
      if (typeof src === 'string') {
        this._imageRegistry[src] = image;
      }
    }
    return image;
  }
};

var AnnotationsMixin = {
  annotate(x, y, w, h, options) {
    options.Type = 'Annot';
    options.Rect = this._convertRect(x, y, w, h);
    options.Border = [0, 0, 0];
    if (options.Subtype === 'Link' && typeof options.F === 'undefined') {
      options.F = 1 << 2; // Print Annotation Flag
    }
    if (options.Subtype !== 'Link') {
      if (options.C == null) {
        options.C = this._normalizeColor(options.color || [0, 0, 0]);
      }
    } // convert colors
    delete options.color;
    if (typeof options.Dest === 'string') {
      options.Dest = new String(options.Dest);
    }

    // Capitalize keys
    for (let key in options) {
      const val = options[key];
      options[key[0].toUpperCase() + key.slice(1)] = val;
    }
    const ref = this.ref(options);
    this.page.annotations.push(ref);
    ref.end();
    return this;
  },
  note(x, y, w, h, contents, options) {
    if (options === void 0) {
      options = {};
    }
    options.Subtype = 'Text';
    options.Contents = new String(contents);
    options.Name = 'Comment';
    if (options.color == null) {
      options.color = [243, 223, 92];
    }
    return this.annotate(x, y, w, h, options);
  },
  goTo(x, y, w, h, name, options) {
    if (options === void 0) {
      options = {};
    }
    options.Subtype = 'Link';
    options.A = this.ref({
      S: 'GoTo',
      D: new String(name)
    });
    options.A.end();
    return this.annotate(x, y, w, h, options);
  },
  link(x, y, w, h, url, options) {
    if (options === void 0) {
      options = {};
    }
    options.Subtype = 'Link';
    if (typeof url === 'number') {
      // Link to a page in the document (the page must already exist)
      const pages = this._root.data.Pages.data;
      if (url >= 0 && url < pages.Kids.length) {
        options.A = this.ref({
          S: 'GoTo',
          D: [pages.Kids[url], 'XYZ', null, null, null]
        });
        options.A.end();
      } else {
        throw new Error(`The document has no page ${url}`);
      }
    } else {
      // Link to an external url
      options.A = this.ref({
        S: 'URI',
        URI: new String(url)
      });
      options.A.end();
    }
    return this.annotate(x, y, w, h, options);
  },
  _markup(x, y, w, h, options) {
    if (options === void 0) {
      options = {};
    }
    const [x1, y1, x2, y2] = this._convertRect(x, y, w, h);
    options.QuadPoints = [x1, y2, x2, y2, x1, y1, x2, y1];
    options.Contents = new String();
    return this.annotate(x, y, w, h, options);
  },
  highlight(x, y, w, h, options) {
    if (options === void 0) {
      options = {};
    }
    options.Subtype = 'Highlight';
    if (options.color == null) {
      options.color = [241, 238, 148];
    }
    return this._markup(x, y, w, h, options);
  },
  underline(x, y, w, h, options) {
    if (options === void 0) {
      options = {};
    }
    options.Subtype = 'Underline';
    return this._markup(x, y, w, h, options);
  },
  strike(x, y, w, h, options) {
    if (options === void 0) {
      options = {};
    }
    options.Subtype = 'StrikeOut';
    return this._markup(x, y, w, h, options);
  },
  lineAnnotation(x1, y1, x2, y2, options) {
    if (options === void 0) {
      options = {};
    }
    options.Subtype = 'Line';
    options.Contents = new String();
    options.L = [x1, this.page.height - y1, x2, this.page.height - y2];
    return this.annotate(x1, y1, x2, y2, options);
  },
  rectAnnotation(x, y, w, h, options) {
    if (options === void 0) {
      options = {};
    }
    options.Subtype = 'Square';
    options.Contents = new String();
    return this.annotate(x, y, w, h, options);
  },
  ellipseAnnotation(x, y, w, h, options) {
    if (options === void 0) {
      options = {};
    }
    options.Subtype = 'Circle';
    options.Contents = new String();
    return this.annotate(x, y, w, h, options);
  },
  textAnnotation(x, y, w, h, text, options) {
    if (options === void 0) {
      options = {};
    }
    options.Subtype = 'FreeText';
    options.Contents = new String(text);
    options.DA = new String();
    return this.annotate(x, y, w, h, options);
  },
  fileAnnotation(x, y, w, h, file, options) {
    if (file === void 0) {
      file = {};
    }
    if (options === void 0) {
      options = {};
    }
    // create hidden file
    const filespec = this.file(file.src, Object.assign({
      hidden: true
    }, file));
    options.Subtype = 'FileAttachment';
    options.FS = filespec;

    // add description from filespec unless description (Contents) has already been set
    if (options.Contents) {
      options.Contents = new String(options.Contents);
    } else if (filespec.data.Desc) {
      options.Contents = filespec.data.Desc;
    }
    return this.annotate(x, y, w, h, options);
  },
  _convertRect(x1, y1, w, h) {
    // flip y1 and y2
    let y2 = y1;
    y1 += h;

    // make x2
    let x2 = x1 + w;

    // apply current transformation matrix to points
    const [m0, m1, m2, m3, m4, m5] = this._ctm;
    x1 = m0 * x1 + m2 * y1 + m4;
    y1 = m1 * x1 + m3 * y1 + m5;
    x2 = m0 * x2 + m2 * y2 + m4;
    y2 = m1 * x2 + m3 * y2 + m5;
    return [x1, y1, x2, y2];
  }
};

class PDFOutline {
  constructor(document, parent, title, dest, options) {
    if (options === void 0) {
      options = {
        expanded: false
      };
    }
    this.document = document;
    this.options = options;
    this.outlineData = {};
    if (dest !== null) {
      this.outlineData['Dest'] = [dest.dictionary, 'Fit'];
    }
    if (parent !== null) {
      this.outlineData['Parent'] = parent;
    }
    if (title !== null) {
      this.outlineData['Title'] = new String(title);
    }
    this.dictionary = this.document.ref(this.outlineData);
    this.children = [];
  }
  addItem(title, options) {
    if (options === void 0) {
      options = {
        expanded: false
      };
    }
    const result = new PDFOutline(this.document, this.dictionary, title, this.document.page, options);
    this.children.push(result);
    return result;
  }
  endOutline() {
    if (this.children.length > 0) {
      if (this.options.expanded) {
        this.outlineData.Count = this.children.length;
      }
      const first = this.children[0],
        last = this.children[this.children.length - 1];
      this.outlineData.First = first.dictionary;
      this.outlineData.Last = last.dictionary;
      for (let i = 0, len = this.children.length; i < len; i++) {
        const child = this.children[i];
        if (i > 0) {
          child.outlineData.Prev = this.children[i - 1].dictionary;
        }
        if (i < this.children.length - 1) {
          child.outlineData.Next = this.children[i + 1].dictionary;
        }
        child.endOutline();
      }
    }
    return this.dictionary.end();
  }
}

var OutlineMixin = {
  initOutline() {
    return this.outline = new PDFOutline(this, null, null, null);
  },
  endOutline() {
    this.outline.endOutline();
    if (this.outline.children.length > 0) {
      this._root.data.Outlines = this.outline.dictionary;
      return this._root.data.PageMode = 'UseOutlines';
    }
  }
};

/*
PDFStructureContent - a reference to a marked structure content
By Ben Schmidt
*/

class PDFStructureContent {
  constructor(pageRef, mcid) {
    this.refs = [{
      pageRef,
      mcid
    }];
  }
  push(structContent) {
    structContent.refs.forEach(ref => this.refs.push(ref));
  }
}

/*
PDFStructureElement - represents an element in the PDF logical structure tree
By Ben Schmidt
*/

class PDFStructureElement {
  constructor(document, type, options, children) {
    if (options === void 0) {
      options = {};
    }
    if (children === void 0) {
      children = null;
    }
    this.document = document;
    this._attached = false;
    this._ended = false;
    this._flushed = false;
    this.dictionary = document.ref({
      // Type: "StructElem",
      S: type
    });
    const data = this.dictionary.data;
    if (Array.isArray(options) || this._isValidChild(options)) {
      children = options;
      options = {};
    }
    if (typeof options.title !== 'undefined') {
      data.T = new String(options.title);
    }
    if (typeof options.lang !== 'undefined') {
      data.Lang = new String(options.lang);
    }
    if (typeof options.alt !== 'undefined') {
      data.Alt = new String(options.alt);
    }
    if (typeof options.expanded !== 'undefined') {
      data.E = new String(options.expanded);
    }
    if (typeof options.actual !== 'undefined') {
      data.ActualText = new String(options.actual);
    }
    this._children = [];
    if (children) {
      if (!Array.isArray(children)) {
        children = [children];
      }
      children.forEach(child => this.add(child));
      this.end();
    }
  }
  add(child) {
    if (this._ended) {
      throw new Error(`Cannot add child to already-ended structure element`);
    }
    if (!this._isValidChild(child)) {
      throw new Error(`Invalid structure element child`);
    }
    if (child instanceof PDFStructureElement) {
      child.setParent(this.dictionary);
      if (this._attached) {
        child.setAttached();
      }
    }
    if (child instanceof PDFStructureContent) {
      this._addContentToParentTree(child);
    }
    if (typeof child === 'function' && this._attached) {
      // _contentForClosure() adds the content to the parent tree
      child = this._contentForClosure(child);
    }
    this._children.push(child);
    return this;
  }
  _addContentToParentTree(content) {
    content.refs.forEach(_ref => {
      let {
        pageRef,
        mcid
      } = _ref;
      const pageStructParents = this.document.getStructParentTree().get(pageRef.data.StructParents);
      pageStructParents[mcid] = this.dictionary;
    });
  }
  setParent(parentRef) {
    if (this.dictionary.data.P) {
      throw new Error(`Structure element added to more than one parent`);
    }
    this.dictionary.data.P = parentRef;
    this._flush();
  }
  setAttached() {
    if (this._attached) {
      return;
    }
    this._children.forEach((child, index) => {
      if (child instanceof PDFStructureElement) {
        child.setAttached();
      }
      if (typeof child === 'function') {
        this._children[index] = this._contentForClosure(child);
      }
    });
    this._attached = true;
    this._flush();
  }
  end() {
    if (this._ended) {
      return;
    }
    this._children.filter(child => child instanceof PDFStructureElement).forEach(child => child.end());
    this._ended = true;
    this._flush();
  }
  _isValidChild(child) {
    return child instanceof PDFStructureElement || child instanceof PDFStructureContent || typeof child === 'function';
  }
  _contentForClosure(closure) {
    const content = this.document.markStructureContent(this.dictionary.data.S);
    closure();
    this.document.endMarkedContent();
    this._addContentToParentTree(content);
    return content;
  }
  _isFlushable() {
    if (!this.dictionary.data.P || !this._ended) {
      return false;
    }
    return this._children.every(child => {
      if (typeof child === 'function') {
        return false;
      }
      if (child instanceof PDFStructureElement) {
        return child._isFlushable();
      }
      return true;
    });
  }
  _flush() {
    if (this._flushed || !this._isFlushable()) {
      return;
    }
    this.dictionary.data.K = [];
    this._children.forEach(child => this._flushChild(child));
    this.dictionary.end();

    // free memory used by children; the dictionary itself may still be
    // referenced by a parent structure element or root, but we can
    // at least trim the tree here
    this._children = [];
    this.dictionary.data.K = null;
    this._flushed = true;
  }
  _flushChild(child) {
    if (child instanceof PDFStructureElement) {
      this.dictionary.data.K.push(child.dictionary);
    }
    if (child instanceof PDFStructureContent) {
      child.refs.forEach(_ref2 => {
        let {
          pageRef,
          mcid
        } = _ref2;
        if (!this.dictionary.data.Pg) {
          this.dictionary.data.Pg = pageRef;
        }
        if (this.dictionary.data.Pg === pageRef) {
          this.dictionary.data.K.push(mcid);
        } else {
          this.dictionary.data.K.push({
            Type: 'MCR',
            Pg: pageRef,
            MCID: mcid
          });
        }
      });
    }
  }
}

/*
PDFNumberTree - represents a number tree object
*/

class PDFNumberTree extends PDFTree {
  _compareKeys(a, b) {
    return parseInt(a) - parseInt(b);
  }
  _keysName() {
    return 'Nums';
  }
  _dataForKey(k) {
    return parseInt(k);
  }
}

/*
Markings mixin - support marked content sequences in content streams
By Ben Schmidt
*/

var MarkingsMixin = {
  initMarkings(options) {
    this.structChildren = [];
    if (options.tagged) {
      this.getMarkInfoDictionary().data.Marked = true;
      this.getStructTreeRoot();
    }
  },
  markContent(tag, options) {
    if (options === void 0) {
      options = null;
    }
    if (tag === 'Artifact' || options && options.mcid) {
      let toClose = 0;
      this.page.markings.forEach(marking => {
        if (toClose || marking.structContent || marking.tag === 'Artifact') {
          toClose++;
        }
      });
      while (toClose--) {
        this.endMarkedContent();
      }
    }
    if (!options) {
      this.page.markings.push({
        tag
      });
      this.addContent(`/${tag} BMC`);
      return this;
    }
    this.page.markings.push({
      tag,
      options
    });
    const dictionary = {};
    if (typeof options.mcid !== 'undefined') {
      dictionary.MCID = options.mcid;
    }
    if (tag === 'Artifact') {
      if (typeof options.type === 'string') {
        dictionary.Type = options.type;
      }
      if (Array.isArray(options.bbox)) {
        dictionary.BBox = [options.bbox[0], this.page.height - options.bbox[3], options.bbox[2], this.page.height - options.bbox[1]];
      }
      if (Array.isArray(options.attached) && options.attached.every(val => typeof val === 'string')) {
        dictionary.Attached = options.attached;
      }
    }
    if (tag === 'Span') {
      if (options.lang) {
        dictionary.Lang = new String(options.lang);
      }
      if (options.alt) {
        dictionary.Alt = new String(options.alt);
      }
      if (options.expanded) {
        dictionary.E = new String(options.expanded);
      }
      if (options.actual) {
        dictionary.ActualText = new String(options.actual);
      }
    }
    this.addContent(`/${tag} ${PDFObject$1.convert(dictionary)} BDC`);
    return this;
  },
  markStructureContent(tag, options) {
    if (options === void 0) {
      options = {};
    }
    const pageStructParents = this.getStructParentTree().get(this.page.structParentTreeKey);
    const mcid = pageStructParents.length;
    pageStructParents.push(null);
    this.markContent(tag, {
      ...options,
      mcid
    });
    const structContent = new PDFStructureContent(this.page.dictionary, mcid);
    this.page.markings.slice(-1)[0].structContent = structContent;
    return structContent;
  },
  endMarkedContent() {
    this.page.markings.pop();
    this.addContent('EMC');
    return this;
  },
  struct(type, options, children) {
    if (options === void 0) {
      options = {};
    }
    if (children === void 0) {
      children = null;
    }
    return new PDFStructureElement(this, type, options, children);
  },
  addStructure(structElem) {
    const structTreeRoot = this.getStructTreeRoot();
    structElem.setParent(structTreeRoot);
    structElem.setAttached();
    this.structChildren.push(structElem);
    if (!structTreeRoot.data.K) {
      structTreeRoot.data.K = [];
    }
    structTreeRoot.data.K.push(structElem.dictionary);
    return this;
  },
  initPageMarkings(pageMarkings) {
    pageMarkings.forEach(marking => {
      if (marking.structContent) {
        const structContent = marking.structContent;
        const newStructContent = this.markStructureContent(marking.tag, marking.options);
        structContent.push(newStructContent);
        this.page.markings.slice(-1)[0].structContent = structContent;
      } else {
        this.markContent(marking.tag, marking.options);
      }
    });
  },
  endPageMarkings(page) {
    const pageMarkings = page.markings;
    pageMarkings.forEach(() => page.write('EMC'));
    page.markings = [];
    return pageMarkings;
  },
  getMarkInfoDictionary() {
    if (!this._root.data.MarkInfo) {
      this._root.data.MarkInfo = this.ref({});
    }
    return this._root.data.MarkInfo;
  },
  getStructTreeRoot() {
    if (!this._root.data.StructTreeRoot) {
      this._root.data.StructTreeRoot = this.ref({
        Type: 'StructTreeRoot',
        ParentTree: new PDFNumberTree(),
        ParentTreeNextKey: 0
      });
    }
    return this._root.data.StructTreeRoot;
  },
  getStructParentTree() {
    return this.getStructTreeRoot().data.ParentTree;
  },
  createStructParentTreeNextKey() {
    // initialise the MarkInfo dictionary
    this.getMarkInfoDictionary();
    const structTreeRoot = this.getStructTreeRoot();
    const key = structTreeRoot.data.ParentTreeNextKey++;
    structTreeRoot.data.ParentTree.add(key, []);
    return key;
  },
  endMarkings() {
    const structTreeRoot = this._root.data.StructTreeRoot;
    if (structTreeRoot) {
      structTreeRoot.end();
      this.structChildren.forEach(structElem => structElem.end());
    }
    if (this._root.data.MarkInfo) {
      this._root.data.MarkInfo.end();
    }
  }
};

const FIELD_FLAGS = {
  readOnly: 1,
  required: 2,
  noExport: 4,
  multiline: 0x1000,
  password: 0x2000,
  toggleToOffButton: 0x4000,
  radioButton: 0x8000,
  pushButton: 0x10000,
  combo: 0x20000,
  edit: 0x40000,
  sort: 0x80000,
  multiSelect: 0x200000,
  noSpell: 0x400000
};
const FIELD_JUSTIFY = {
  left: 0,
  center: 1,
  right: 2
};
const VALUE_MAP = {
  value: 'V',
  defaultValue: 'DV'
};
const FORMAT_SPECIAL = {
  zip: '0',
  zipPlus4: '1',
  zip4: '1',
  phone: '2',
  ssn: '3'
};
const FORMAT_DEFAULT = {
  number: {
    nDec: 0,
    sepComma: false,
    negStyle: 'MinusBlack',
    currency: '',
    currencyPrepend: true
  },
  percent: {
    nDec: 0,
    sepComma: false
  }
};
var AcroFormMixin = {
  /**
   * Must call if adding AcroForms to a document. Must also call font() before
   * this method to set the default font.
   */
  initForm() {
    if (!this._font) {
      throw new Error('Must set a font before calling initForm method');
    }
    this._acroform = {
      fonts: {},
      defaultFont: this._font.name
    };
    this._acroform.fonts[this._font.id] = this._font.ref();
    let data = {
      Fields: [],
      NeedAppearances: true,
      DA: new String(`/${this._font.id} 0 Tf 0 g`),
      DR: {
        Font: {}
      }
    };
    data.DR.Font[this._font.id] = this._font.ref();
    const AcroForm = this.ref(data);
    this._root.data.AcroForm = AcroForm;
    return this;
  },
  /**
   * Called automatically by document.js
   */
  endAcroForm() {
    if (this._root.data.AcroForm) {
      if (!Object.keys(this._acroform.fonts).length && !this._acroform.defaultFont) {
        throw new Error('No fonts specified for PDF form');
      }
      let fontDict = this._root.data.AcroForm.data.DR.Font;
      Object.keys(this._acroform.fonts).forEach(name => {
        fontDict[name] = this._acroform.fonts[name];
      });
      this._root.data.AcroForm.data.Fields.forEach(fieldRef => {
        this._endChild(fieldRef);
      });
      this._root.data.AcroForm.end();
    }
    return this;
  },
  _endChild(ref) {
    if (Array.isArray(ref.data.Kids)) {
      ref.data.Kids.forEach(childRef => {
        this._endChild(childRef);
      });
      ref.end();
    }
    return this;
  },
  /**
   * Creates and adds a form field to the document. Form fields are intermediate
   * nodes in a PDF form that are used to specify form name heirarchy and form
   * value defaults.
   * @param {string} name - field name (T attribute in field dictionary)
   * @param {object} options  - other attributes to include in field dictionary
   */
  formField(name, options) {
    if (options === void 0) {
      options = {};
    }
    let fieldDict = this._fieldDict(name, null, options);
    let fieldRef = this.ref(fieldDict);
    this._addToParent(fieldRef);
    return fieldRef;
  },
  /**
   * Creates and adds a Form Annotation to the document. Form annotations are
   * called Widget annotations internally within a PDF file.
   * @param {string} name - form field name (T attribute of widget annotation
   * dictionary)
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {object} options
   */
  formAnnotation(name, type, x, y, w, h, options) {
    if (options === void 0) {
      options = {};
    }
    let fieldDict = this._fieldDict(name, type, options);
    fieldDict.Subtype = 'Widget';
    if (fieldDict.F === undefined) {
      fieldDict.F = 4; // print the annotation
    }

    // Add Field annot to page, and get it's ref
    this.annotate(x, y, w, h, fieldDict);
    let annotRef = this.page.annotations[this.page.annotations.length - 1];
    return this._addToParent(annotRef);
  },
  formText(name, x, y, w, h, options) {
    if (options === void 0) {
      options = {};
    }
    return this.formAnnotation(name, 'text', x, y, w, h, options);
  },
  formPushButton(name, x, y, w, h, options) {
    if (options === void 0) {
      options = {};
    }
    return this.formAnnotation(name, 'pushButton', x, y, w, h, options);
  },
  formCombo(name, x, y, w, h, options) {
    if (options === void 0) {
      options = {};
    }
    return this.formAnnotation(name, 'combo', x, y, w, h, options);
  },
  formList(name, x, y, w, h, options) {
    if (options === void 0) {
      options = {};
    }
    return this.formAnnotation(name, 'list', x, y, w, h, options);
  },
  formRadioButton(name, x, y, w, h, options) {
    if (options === void 0) {
      options = {};
    }
    return this.formAnnotation(name, 'radioButton', x, y, w, h, options);
  },
  formCheckbox(name, x, y, w, h, options) {
    if (options === void 0) {
      options = {};
    }
    return this.formAnnotation(name, 'checkbox', x, y, w, h, options);
  },
  _addToParent(fieldRef) {
    let parent = fieldRef.data.Parent;
    if (parent) {
      if (!parent.data.Kids) {
        parent.data.Kids = [];
      }
      parent.data.Kids.push(fieldRef);
    } else {
      this._root.data.AcroForm.data.Fields.push(fieldRef);
    }
    return this;
  },
  _fieldDict(name, type, options) {
    if (options === void 0) {
      options = {};
    }
    if (!this._acroform) {
      throw new Error('Call document.initForms() method before adding form elements to document');
    }
    let opts = Object.assign({}, options);
    if (type !== null) {
      opts = this._resolveType(type, options);
    }
    opts = this._resolveFlags(opts);
    opts = this._resolveJustify(opts);
    opts = this._resolveFont(opts);
    opts = this._resolveStrings(opts);
    opts = this._resolveColors(opts);
    opts = this._resolveFormat(opts);
    opts.T = new String(name);
    if (opts.parent) {
      opts.Parent = opts.parent;
      delete opts.parent;
    }
    return opts;
  },
  _resolveType(type, opts) {
    if (type === 'text') {
      opts.FT = 'Tx';
    } else if (type === 'pushButton') {
      opts.FT = 'Btn';
      opts.pushButton = true;
    } else if (type === 'radioButton') {
      opts.FT = 'Btn';
      opts.radioButton = true;
    } else if (type === 'checkbox') {
      opts.FT = 'Btn';
    } else if (type === 'combo') {
      opts.FT = 'Ch';
      opts.combo = true;
    } else if (type === 'list') {
      opts.FT = 'Ch';
    } else {
      throw new Error(`Invalid form annotation type '${type}'`);
    }
    return opts;
  },
  _resolveFormat(opts) {
    const f = opts.format;
    if (f && f.type) {
      let fnKeystroke;
      let fnFormat;
      let params = '';
      if (FORMAT_SPECIAL[f.type] !== undefined) {
        fnKeystroke = `AFSpecial_Keystroke`;
        fnFormat = `AFSpecial_Format`;
        params = FORMAT_SPECIAL[f.type];
      } else {
        let format = f.type.charAt(0).toUpperCase() + f.type.slice(1);
        fnKeystroke = `AF${format}_Keystroke`;
        fnFormat = `AF${format}_Format`;
        if (f.type === 'date') {
          fnKeystroke += 'Ex';
          params = String(f.param);
        } else if (f.type === 'time') {
          params = String(f.param);
        } else if (f.type === 'number') {
          let p = Object.assign({}, FORMAT_DEFAULT.number, f);
          params = String([String(p.nDec), p.sepComma ? '0' : '1', '"' + p.negStyle + '"', 'null', '"' + p.currency + '"', String(p.currencyPrepend)].join(','));
        } else if (f.type === 'percent') {
          let p = Object.assign({}, FORMAT_DEFAULT.percent, f);
          params = String([String(p.nDec), p.sepComma ? '0' : '1'].join(','));
        }
      }
      opts.AA = opts.AA ? opts.AA : {};
      opts.AA.K = {
        S: 'JavaScript',
        JS: new String(`${fnKeystroke}(${params});`)
      };
      opts.AA.F = {
        S: 'JavaScript',
        JS: new String(`${fnFormat}(${params});`)
      };
    }
    delete opts.format;
    return opts;
  },
  _resolveColors(opts) {
    let color = this._normalizeColor(opts.backgroundColor);
    if (color) {
      if (!opts.MK) {
        opts.MK = {};
      }
      opts.MK.BG = color;
    }
    color = this._normalizeColor(opts.borderColor);
    if (color) {
      if (!opts.MK) {
        opts.MK = {};
      }
      opts.MK.BC = color;
    }
    delete opts.backgroundColor;
    delete opts.borderColor;
    return opts;
  },
  _resolveFlags(options) {
    let result = 0;
    Object.keys(options).forEach(key => {
      if (FIELD_FLAGS[key]) {
        result |= FIELD_FLAGS[key];
        delete options[key];
      }
    });
    if (result !== 0) {
      options.Ff = options.Ff ? options.Ff : 0;
      options.Ff |= result;
    }
    return options;
  },
  _resolveJustify(options) {
    let result = 0;
    if (options.align !== undefined) {
      if (typeof FIELD_JUSTIFY[options.align] === 'number') {
        result = FIELD_JUSTIFY[options.align];
      }
      delete options.align;
    }
    if (result !== 0) {
      options.Q = result; // default
    }
    return options;
  },
  _resolveFont(options) {
    // add current font to document-level AcroForm dict if necessary
    if (this._acroform.fonts[this._font.id] === null) {
      this._acroform.fonts[this._font.id] = this._font.ref();
    }

    // add current font to field's resource dict (RD) if not the default acroform font
    if (this._acroform.defaultFont !== this._font.name) {
      options.DR = {
        Font: {}
      };

      // Get the fontSize option. If not set use auto sizing
      const fontSize = options.fontSize || 0;
      options.DR.Font[this._font.id] = this._font.ref();
      options.DA = new String(`/${this._font.id} ${fontSize} Tf 0 g`);
    }
    return options;
  },
  _resolveStrings(options) {
    let select = [];
    function appendChoices(a) {
      if (Array.isArray(a)) {
        for (let idx = 0; idx < a.length; idx++) {
          if (typeof a[idx] === 'string') {
            select.push(new String(a[idx]));
          } else {
            select.push(a[idx]);
          }
        }
      }
    }
    appendChoices(options.Opt);
    if (options.select) {
      appendChoices(options.select);
      delete options.select;
    }
    if (select.length) {
      options.Opt = select;
    }
    Object.keys(VALUE_MAP).forEach(key => {
      if (options[key] !== undefined) {
        options[VALUE_MAP[key]] = options[key];
        delete options[key];
      }
    });
    ['V', 'DV'].forEach(key => {
      if (typeof options[key] === 'string') {
        options[key] = new String(options[key]);
      }
    });
    if (options.MK && options.MK.CA) {
      options.MK.CA = new String(options.MK.CA);
    }
    if (options.label) {
      options.MK = options.MK ? options.MK : {};
      options.MK.CA = new String(options.label);
      delete options.label;
    }
    return options;
  }
};

var AttachmentsMixin = {
  /**
   * Embed contents of `src` in PDF
   * @param {Buffer | ArrayBuffer | string} src input Buffer, ArrayBuffer, base64 encoded string or path to file
   * @param {object} options
   *  * options.name: filename to be shown in PDF, will use `src` if none set
   *  * options.type: filetype to be shown in PDF
   *  * options.description: description to be shown in PDF
   *  * options.hidden: if true, do not add attachment to EmbeddedFiles dictionary. Useful for file attachment annotations
   *  * options.creationDate: override creation date
   *  * options.modifiedDate: override modified date
   * @returns filespec reference
   */
  file(src, options) {
    if (options === void 0) {
      options = {};
    }
    options.name = options.name || src;
    const refBody = {
      Type: 'EmbeddedFile',
      Params: {}
    };
    let data;
    if (!src) {
      throw new Error('No src specified');
    }
    if (Buffer$2.isBuffer(src)) {
      data = src;
    } else if (src instanceof ArrayBuffer) {
      data = Buffer$2.from(new Uint8Array(src));
    } else {
      let match;
      if (match = /^data:(.*);base64,(.*)$/.exec(src)) {
        if (match[1]) {
          refBody.Subtype = match[1].replace('/', '#2F');
        }
        data = Buffer$2.from(match[2], 'base64');
      } else {
        throw new Error(`Could not find file ${src}`);
      }
    }

    // override creation date and modified date
    if (options.creationDate instanceof Date) {
      refBody.Params.CreationDate = options.creationDate;
    }
    if (options.modifiedDate instanceof Date) {
      refBody.Params.ModDate = options.modifiedDate;
    }
    // add optional subtype
    if (options.type) {
      refBody.Subtype = options.type.replace('/', '#2F');
    }

    // add checksum and size information
    const checksum = MD5(CryptoJS.lib.WordArray.create(new Uint8Array(data)));
    refBody.Params.CheckSum = new String(checksum);
    refBody.Params.Size = data.byteLength;

    // save some space when embedding the same file again
    // if a file with the same name and metadata exists, reuse its reference
    let ref;
    if (!this._fileRegistry) this._fileRegistry = {};
    let file = this._fileRegistry[options.name];
    if (file && isEqual(refBody, file)) {
      ref = file.ref;
    } else {
      ref = this.ref(refBody);
      ref.end(data);
      this._fileRegistry[options.name] = {
        ...refBody,
        ref
      };
    }
    // add filespec for embedded file
    const fileSpecBody = {
      Type: 'Filespec',
      F: new String(options.name),
      EF: {
        F: ref
      },
      UF: new String(options.name)
    };
    if (options.description) {
      fileSpecBody.Desc = new String(options.description);
    }
    const filespec = this.ref(fileSpecBody);
    filespec.end();
    if (!options.hidden) {
      this.addNamedEmbeddedFile(options.name, filespec);
    }
    return filespec;
  }
};

/** check two embedded file metadata objects for equality */
function isEqual(a, b) {
  return a.Subtype === b.Subtype && a.Params.CheckSum.toString() === b.Params.CheckSum.toString() && a.Params.Size === b.Params.Size && a.Params.CreationDate === b.Params.CreationDate && a.Params.ModDate === b.Params.ModDate;
}

class PDFMetadata {
  constructor() {
    this._metadata = `
        <?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
            <x:xmpmeta xmlns:x="adobe:ns:meta/">
                <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
        `;
  }
  _closeTags() {
    this._metadata = this._metadata.concat(`
                </rdf:RDF>
            </x:xmpmeta>
        <?xpacket end="w"?>
        `);
  }
  append(xml, newline) {
    if (newline === void 0) {
      newline = true;
    }
    this._metadata = this._metadata.concat(xml);
    if (newline) this._metadata = this._metadata.concat('\n');
  }
  getXML() {
    return this._metadata;
  }
  getLength() {
    return this._metadata.length;
  }
  end() {
    this._closeTags();
    this._metadata = this._metadata.trim();
  }
}

var MetadataMixin = {
  initMetadata() {
    this.metadata = new PDFMetadata();
  },
  appendXML(xml, newline) {
    if (newline === void 0) {
      newline = true;
    }
    this.metadata.append(xml, newline);
  },
  _addInfo() {
    this.appendXML(`
        <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
            <xmp:CreateDate>${this.info.CreationDate.toISOString().split('.')[0] + 'Z'}</xmp:CreateDate>
            <xmp:CreatorTool>${this.info.Creator}</xmp:CreatorTool>
        </rdf:Description>
        `);
    if (this.info.Title || this.info.Author || this.info.Subject) {
      this.appendXML(`
            <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
            `);
      if (this.info.Title) {
        this.appendXML(`
                <dc:title>
                    <rdf:Alt>
                        <rdf:li xml:lang="x-default">${this.info.Title}</rdf:li>
                    </rdf:Alt>
                </dc:title>
                `);
      }
      if (this.info.Author) {
        this.appendXML(`
                <dc:creator>
                    <rdf:Seq>
                        <rdf:li>${this.info.Author}</rdf:li>
                    </rdf:Seq>
                </dc:creator>
                `);
      }
      if (this.info.Subject) {
        this.appendXML(`
                <dc:description>
                    <rdf:Alt>
                        <rdf:li xml:lang="x-default">${this.info.Subject}</rdf:li>
                    </rdf:Alt>
                </dc:description>
                `);
      }
      this.appendXML(`
            </rdf:Description>
            `);
    }
    this.appendXML(`
        <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
            <pdf:Producer>${this.info.Creator}</pdf:Producer>`, false);
    if (this.info.Keywords) {
      this.appendXML(`
            <pdf:Keywords>${this.info.Keywords}</pdf:Keywords>`, false);
    }
    this.appendXML(`
        </rdf:Description>
        `);
  },
  endMetadata() {
    this._addInfo();
    this.metadata.end();

    /*
        Metadata was introduced in PDF 1.4, so adding it to 1.3
        will likely only take up more space.
        */
    if (this.version != 1.3) {
      this.metadataRef = this.ref({
        length: this.metadata.getLength(),
        Type: 'Metadata',
        Subtype: 'XML'
      });
      this.metadataRef.compress = false;
      this.metadataRef.write(Buffer$2.from(this.metadata.getXML(), 'utf-8'));
      this.metadataRef.end();
      this._root.data.Metadata = this.metadataRef;
    }
  }
};

const capitalize = v => v[0].toUpperCase() + v.slice(1);

class PDFDocument extends stream.Readable {
  constructor(options) {
    if (options === void 0) {
      options = {};
    }
    super();
    this.options = options;

    // PDF version
    switch (options.pdfVersion) {
      case '1.4':
        this.version = 1.4;
        break;
      case '1.5':
        this.version = 1.5;
        break;
      case '1.6':
        this.version = 1.6;
        break;
      case '1.7':
      case '1.7ext3':
        this.version = 1.7;
        break;
      default:
        this.version = 1.3;
        break;
    }

    // Whether streams should be compressed
    this.compress = this.options.compress != null ? this.options.compress : true;
    this._pageBuffer = [];
    this._pageBufferStart = 0;

    // The PDF object store
    this._offsets = [];
    this._waiting = 0;
    this._ended = false;
    this._offset = 0;
    const Pages = this.ref({
      Type: 'Pages',
      Count: 0,
      Kids: []
    });
    const Names = this.ref({
      Dests: new PDFNameTree()
    });
    this._root = this.ref({
      Type: 'Catalog',
      Pages,
      Names
    });
    if (this.options.lang) {
      this._root.data.Lang = new String(this.options.lang);
    }
    if (this.options.pageLayout) {
      this._root.data.PageLayout = capitalize(this.options.pageLayout);
    }
    if (this.options.pageMode) {
      this._root.data.PageMode = capitalize(this.options.pageMode);
    }

    // The current page
    this.page = null;

    // Initialize mixins
    this.initColor();
    this.initVector();
    this.initFonts();
    this.initText();
    this.initImages();
    this.initOutline();
    // this.initMarkings(options)

    // Initialize the metadata
    this.info = {
      Producer: 'PDFKit',
      Creator: 'PDFKit',
      CreationDate: new Date()
    };
    if (this.options.info) {
      for (let key in this.options.info) {
        const val = this.options.info[key];
        this.info[key] = val;
      }
    }
    if (this.options.displayTitle) {
      this._root.data.ViewerPreferences = this.ref({
        DisplayDocTitle: true
      });
    }

    // Generate file ID
    this._id = PDFSecurity.generateFileID(this.info);

    // Initialize security settings
    // this._security = PDFSecurity.create(this, options);

    // Write the header PDF version
    this._write(`%PDF-${this.version}`);

    // 4 binary chars, as recommended by the spec
    this._write('%\xFF\xFF\xFF\xFF');

    // Add the first page
    if (this.options.autoFirstPage !== false) {
      this.addPage();
    }
  }
  addPage(options) {
    // end the current page if needed
    if (options == null) {
      ({
        options
      } = this);
    }

    // end the current page if needed
    if (!this.options.bufferPages) {
      this.flushPages();
    }

    // create a page object
    this.page = new PDFPage(this, options);
    this._pageBuffer.push(this.page);

    // add the page to the object store
    const pages = this._root.data.Pages.data;
    pages.Kids.push(this.page.dictionary);
    pages.Count++;

    // flip PDF coordinate system so that the origin is in
    // the top left rather than the bottom left
    this._ctm = [1, 0, 0, 1, 0, 0];
    this.transform(1, 0, 0, -1, 0, this.page.height);

    // this.emit('pageAdded');

    return this;
  }
  flushPages() {
    // this local variable exists so we're future-proof against
    // reentrant calls to flushPages.
    const pages = this._pageBuffer;
    this._pageBuffer = [];
    this._pageBufferStart += pages.length;
    for (let page of Array.from(pages)) {
      // this.endPageMarkings(page);
      page.end();
    }
  }
  addNamedDestination(name) {
    for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }
    if (args.length === 0) {
      args = ['XYZ', null, null, null];
    }
    if (args[0] === 'XYZ' && args[2] !== null) {
      args[2] = this.page.height - args[2];
    }
    args.unshift(this.page.dictionary);
    this._root.data.Names.data.Dests.add(name, args);
  }
  addNamedEmbeddedFile(name, ref) {
    if (!this._root.data.Names.data.EmbeddedFiles) {
      // disabling /Limits for this tree fixes attachments not showing in Adobe Reader
      this._root.data.Names.data.EmbeddedFiles = new PDFNameTree({
        limits: false
      });
    }

    // add filespec to EmbeddedFiles
    this._root.data.Names.data.EmbeddedFiles.add(name, ref);
  }
  addNamedJavaScript(name, js) {
    if (!this._root.data.Names.data.JavaScript) {
      this._root.data.Names.data.JavaScript = new PDFNameTree();
    }
    let data = {
      JS: new String(js),
      S: 'JavaScript'
    };
    this._root.data.Names.data.JavaScript.add(name, data);
  }
  ref(data) {
    const ref = new PDFReference(this, this._offsets.length + 1, data);
    this._offsets.push(null); // placeholder for this object's offset once it is finalized
    this._waiting++;
    return ref;
  }
  _read() {
    // do nothing, but this method is required by node
  }
  _write(data) {
    if (!Buffer$2.isBuffer(data)) {
      data = Buffer$2.from(data + '\n', 'binary');
    }
    this.push(data);
    return this._offset += data.length;
  }
  addContent(data) {
    this.page.write(data);
    return this;
  }
  _refEnd(ref) {
    this._offsets[ref.id - 1] = ref.offset;
    if (--this._waiting === 0 && this._ended) {
      this._finalize();
      return this._ended = false;
    }
  }
  end() {
    this.flushPages();
    this._info = this.ref();
    for (let key in this.info) {
      let val = this.info[key];
      if (typeof val === 'string') {
        val = new String(val);
      }
      let entry = this.ref(val);
      entry.end();
      this._info.data[key] = entry;
    }
    this._info.end();
    for (let name in this._fontFamilies) {
      const font = this._fontFamilies[name];
      font.finalize();
    }
    this.endOutline();
    // this.endMarkings();

    this._root.end();
    this._root.data.Pages.end();
    this._root.data.Names.end();
    this.endAcroForm();
    if (this._root.data.ViewerPreferences) {
      this._root.data.ViewerPreferences.end();
    }

    // if (this._security) {
    //   this._security.end();
    // }

    if (this._waiting === 0) {
      return this._finalize();
    }
    this._ended = true;
  }
  _finalize() {
    // generate xref
    const xRefOffset = this._offset;
    this._write('xref');
    this._write(`0 ${this._offsets.length + 1}`);
    this._write('0000000000 65535 f ');
    for (let offset of Array.from(this._offsets)) {
      offset = `0000000000${offset}`.slice(-10);
      this._write(offset + ' 00000 n ');
    }

    // trailer
    const trailer = {
      Size: this._offsets.length + 1,
      Root: this._root,
      Info: this._info,
      ID: [this._id, this._id]
    };

    // if (this._security) {
    //   trailer.Encrypt = this._security.dictionary;
    // }

    this._write('trailer');
    this._write(PDFObject$1.convert(trailer));
    this._write('startxref');
    this._write(`${xRefOffset}`);
    this._write('%%EOF');

    // end the stream
    return this.push(null);
  }
  toString() {
    return '[object PDFDocument]';
  }
  initColor() {}
  initVector() {}
  initFonts() {}
  initText() {}
  initImages() {}
  initOutline() {}

  /**
   * @param {number} m11
   * @param {number} m12
   * @param {number} m21
   * @param {number} m22
   * @param {number} dx
   * @param {number} dy
   */
  // eslint-disable-next-line no-unused-vars
  transform(m11, m12, m21, m22, dx, dy) {}
  endOutline() {}
  endAcroForm() {}
}
const mixin = methods => {
  Object.assign(PDFDocument.prototype, methods);
};

// Load mixins
mixin(MetadataMixin);
mixin(ColorMixin);
mixin(VectorMixin);
mixin(FontsMixin);
mixin(TextMixin);
mixin(ImagesMixin);
mixin(AnnotationsMixin);
mixin(OutlineMixin);
mixin(MarkingsMixin);
mixin(AcroFormMixin);
mixin(AttachmentsMixin);

export { EmbeddedFont, PDFFont, StandardFont, PDFDocument as default };

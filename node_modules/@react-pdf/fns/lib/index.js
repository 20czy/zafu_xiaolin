/**
 * Applies a function to the value at the given index of an array

 * @param {number} index
 * @param {function} fn
 * @param {array} collection
 * @returns copy of the array with the element at the given index replaced with the result of the function application.
 */
const adjust = (index, fn, collection) => {
  if (index >= 0 && index >= collection.length) return collection;
  if (index < 0 && Math.abs(index) > collection.length) return collection;
  const i = index < 0 ? collection.length + index : index;
  return Object.assign([], collection, {
    [i]: fn(collection[i])
  });
};

/**
 * Reverses the list
 *
 * @template {unknown} T
 * @param {T[]} list list to be reversed
 * @returns {T[]} reversed list
 */
const reverse = list => Array.prototype.slice.call(list, 0).reverse();

/* eslint-disable no-await-in-loop */


/**
 * @typedef {Function} AsyncCompose
 * @param {any} value
 * @param {...any} args
 * @returns {any} result
 */

/**
 * Performs right-to-left function composition with async functions support
 *
 * @param {...Function} fns functions
 * @returns {AsyncCompose} composed function
 */
const asyncCompose = function () {
  for (var _len = arguments.length, fns = new Array(_len), _key = 0; _key < _len; _key++) {
    fns[_key] = arguments[_key];
  }
  return async function (value) {
    let result = value;
    const reversedFns = reverse(fns);
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }
    for (let i = 0; i < reversedFns.length; i += 1) {
      const fn = reversedFns[i];
      result = await fn(result, ...args);
    }
    return result;
  };
};

/**
 * Capitalize first letter of each word
 *
 * @param {string} value string
 * @returns {string} capitalized string
 */
const capitalize = value => {
  if (!value) return value;
  return value.replace(/(^|\s)\S/g, l => l.toUpperCase());
};

/**
 * Casts value to array
 *
 * @template T
 * @param {T|T[]} value value
 * @returns {T[]} array
 */
const castArray = value => {
  return Array.isArray(value) ? value : [value];
};

/* eslint-disable no-await-in-loop */


/**
 * @typedef {Function} Compose
 * @param {any} value
 * @param {...any} args
 * @returns {any} result
 */

/**
 * Performs right-to-left function composition
 *
 * @param {...Function} fns functions
 * @returns {Compose} composed function
 */
const compose = function () {
  for (var _len = arguments.length, fns = new Array(_len), _key = 0; _key < _len; _key++) {
    fns[_key] = arguments[_key];
  }
  return function (value) {
    let result = value;
    const reversedFns = reverse(fns);
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }
    for (let i = 0; i < reversedFns.length; i += 1) {
      const fn = reversedFns[i];
      result = fn(result, ...args);
    }
    return result;
  };
};

/**
 * Drops the last element from an array.
 *
 * @template T
 * @param {T[]} array the array to drop the last element from
 * @returns {T[]} the new array with the last element dropped
 */
const dropLast = array => array.slice(0, array.length - 1);

/**
 * Applies a set of transformations to an object and returns a new object with the transformed values.
 *
 * @template T
 * @param {Record<string, (value: T) => T | Record<string, (value: T) => T>>} transformations - The transformations to apply.
 * @param {T} object the object to transform.
 * @returns {T} the transformed object.
 */
const evolve = (transformations, object) => {
  const result = object instanceof Array ? [] : {};
  const keys = Object.keys(object);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    const transformation = transformations[key];
    const type = typeof transformation;
    if (type === 'function') {
      result[key] = transformation(object[key]);
    } else if (transformation && type === 'object') {
      result[key] = evolve(transformation, object[key]);
    } else {
      result[key] = object[key];
    }
  }
  return result;
};

/**
 * Checks if a value is null or undefined.
 *
 * @template {unknown} T
 * @param {T} value the value to check
 * @returns {T is null | undefined} true if the value is null or undefined, false otherwise
 */
const isNil = value => value === null || value === undefined;

/**
 * Retrieves the value at a given path from an object.
 *
 * @param {object} target the object to retrieve the value from.
 * @param {string | string[]} path the path of the value to retrieve.
 * @param {*} defaultValue the default value to return if the path does not exist.
 * @returns {*} the value at the given path, or the default value if the path does not exist.
 */
const get = (target, path, defaultValue) => {
  if (isNil(target)) return defaultValue;
  const _path = castArray(path);
  let result = target;
  for (let i = 0; i < _path.length; i += 1) {
    if (isNil(result)) return undefined;
    result = result[_path[i]];
  }
  return isNil(result) ? defaultValue : result;
};

/**
 * Returns the last character of a string.
 *
 * @param {string} value the input string
 * @returns {string} the last character of the string
 */
const last = value => {
  return value === '' ? '' : value[value.length - 1];
};

/**
 * Maps over the values of an object and applies a function to each value.
 *
 * @param {Object} object the object to map over
 * @param {Function} fn the function to apply to each value
 * @returns {Object} a new object with the mapped values
 */
const mapValues = (object, fn) => {
  const entries = Object.entries(object);
  return entries.reduce((acc, _ref, index) => {
    let [key, value] = _ref;
    acc[key] = fn(value, key, index);
    return acc;
  }, {});
};

/**
 * @param {string | number} value
 * @returns {RegExpExecArray | null} match
 */
const isPercent = value => /((-)?\d+\.?\d*)%/g.exec(`${value}`);

/**
 * Get percentage value of input
 *
 * @param {string | number} value
 * @returns {{ percent: number, value: number } | null} percent value (if matches)
 */
const matchPercent = value => {
  const match = isPercent(value);
  if (match) {
    const f = parseFloat(match[1]);
    const percent = f / 100;
    return {
      percent,
      value: f
    };
  }
  return null;
};

/**
 * Creates a new object by omitting specified keys from the original object.
 *
 * @param {string|string[]} keys the key or keys to omit
 * @param {object} object the original object
 * @returns {object} the new object without the omitted keys
 */
const omit = (keys, object) => {
  const _keys = castArray(keys);
  const copy = Object.assign({}, object);
  _keys.forEach(key => {
    delete copy[key];
  });
  return copy;
};

/**
 * Picks the specified keys from an object and returns a new object with only those keys.
 *
 * @param {string[]} keys the keys to pick from the object
 * @param {object} obj the object to pick the keys from
 * @returns {object} a new object with only the picked keys
 */
const pick = (keys, obj) => {
  const result = {};
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (key in obj) result[key] = obj[key];
  }
  return result;
};

/**
 * Repeats an element a specified number of times.
 *
 * @template {unknown} T
 * @param {T} element element to be repeated
 * @param {number} length number of times to repeat element
 * @returns {T[]} repeated elements
 */
const repeat = function (elem, length) {
  if (length === void 0) {
    length = 0;
  }
  const result = new Array(length);
  for (let i = 0; i < length; i += 1) {
    result[i] = elem;
  }
  return result;
};

/**
 * Capitalize first letter of string
 *
 * @param {string} value string
 * @returns {string} capitalized string
 */
const upperFirst = value => {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

export { adjust, asyncCompose, capitalize, castArray, compose, dropLast, evolve, get, isNil, last, mapValues, matchPercent, omit, pick, repeat, reverse, upperFirst };

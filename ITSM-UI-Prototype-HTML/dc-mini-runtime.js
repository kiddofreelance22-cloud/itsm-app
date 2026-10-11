/*
 * dc-mini-runtime.js
 * A tiny standalone re-implementation of the "DCLogic / sc-if / sc-for / {{binding}}"
 * template pattern used across this project's pages, so the exported pages run
 * as plain static HTML + vanilla JS in any browser — no external platform needed.
 *
 * Supported template syntax (a subset — exactly what this project's pages use):
 *   {{dotted.path}}               text/attribute interpolation (simple property lookup only)
 *   <sc-if value="{{expr}}">...</sc-if>            conditional render (no wrapper element)
 *   <sc-for list="{{expr}}" as="item">...</sc-for> loop render (no wrapper element)
 *   value="{{expr}}"     -> two-way bound value (input/textarea/select), also used to
 *                           restore focus + cursor position across re-renders
 *   checked="{{expr}}"   -> two-way bound checked state (checkbox/radio)
 *   onClick="{{expr}}"   -> click handler (expr resolves to a function on the scope)
 *   onChange="{{expr}}"  -> change/input handler (input event for text-like fields,
 *                           change event for select/checkbox/radio)
 *   any other attribute containing {{...}} -> plain string substitution
 *
 * A Component looks exactly like the original files: `class Component extends DCLogic`
 * with a constructor(props) that sets this.state, and a renderVals() method that
 * returns the bindings object used by the template above.
 */
(function (global) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var PATH_RE = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;

  function resolvePath(expr, scope) {
    expr = expr.trim();
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (!PATH_RE.test(expr)) return undefined;
    var parts = expr.split('.');
    var cur = scope;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  // Replace every {{expr}} occurrence inside a string with its resolved value.
  function interpolateString(str, scope) {
    return str.replace(/\{\{\s*([^}]+?)\s*\}\}/g, function (_, expr) {
      var v = resolvePath(expr, scope);
      return v === undefined || v === null ? '' : String(v);
    });
  }

  // A whole-attribute value that is *exactly* one {{expr}} — return the raw resolved
  // value (not stringified) so booleans/functions/objects survive intact.
  function resolveWholeExpr(str, scope) {
    var m = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(str.trim());
    if (!m) return undefined;
    return resolvePath(m[1], scope);
  }

  function isSvgTag(name) {
    return name === 'svg' || name === 'path' || name === 'rect' || name === 'circle' ||
      name === 'line' || name === 'polyline' || name === 'polygon' || name === 'g' ||
      name === 'ellipse' || name === 'defs' || name === 'clipPath' || name === 'use';
  }

  // Render a single template node into zero or more real DOM nodes.
  function renderNode(tplNode, scope, svgMode) {
    if (tplNode.nodeType === Node.TEXT_NODE) {
      var text = tplNode.textContent;
      if (text.indexOf('{{') === -1) {
        return [document.createTextNode(text)];
      }
      return [document.createTextNode(interpolateString(text, scope))];
    }
    if (tplNode.nodeType !== Node.ELEMENT_NODE) return [];

    var tag = tplNode.tagName.toLowerCase();

    if (tag === 'sc-if') {
      var cond = resolveWholeExpr(tplNode.getAttribute('value') || '', scope);
      if (!cond) return [];
      return renderChildren(tplNode, scope, svgMode);
    }

    if (tag === 'sc-for') {
      var listExpr = tplNode.getAttribute('list') || '';
      var asName = tplNode.getAttribute('as') || 'item';
      var list = resolveWholeExpr(listExpr, scope) || [];
      var out = [];
      for (var i = 0; i < list.length; i++) {
        var childScope = Object.create(scope);
        childScope[asName] = list[i];
        childScope[asName + 'Index'] = i;
        var rendered = renderChildren(tplNode, childScope, svgMode);
        for (var j = 0; j < rendered.length; j++) out.push(rendered[j]);
      }
      return out;
    }

    var nextSvgMode = svgMode || tag === 'svg';
    var el = nextSvgMode ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);

    var attrs = tplNode.attributes;
    var deferredValue; // {expr} for value=
    var deferredChecked; // resolved boolean for checked=

    for (var a = 0; a < attrs.length; a++) {
      var name = attrs[a].name;
      var val = attrs[a].value;
      var hasBinding = val.indexOf('{{') !== -1;

      if (name === 'onclick' || name === 'onchange') {
        if (hasBinding) {
          var fn = resolveWholeExpr(val, scope);
          if (typeof fn === 'function') {
            if (name === 'onclick') {
              el.addEventListener('click', fn);
            } else {
              var isTextLike = tag === 'textarea' ||
                (tag === 'input' && ['text', 'number', 'email', 'search', 'tel', 'password', 'url'].indexOf((el.getAttribute('type') || 'text').toLowerCase()) !== -1);
              el.addEventListener(isTextLike ? 'input' : 'change', fn);
              if (isTextLike) el.addEventListener('change', fn); // also cover blur-only listeners
            }
          }
        }
        continue;
      }

      if (name === 'value' && hasBinding) {
        deferredValue = resolveWholeExpr(val, scope);
        // remember the raw expression text as a stable focus key
        el.setAttribute('data-focus-key', val.replace(/[{}]/g, '').trim());
        continue;
      }

      if (name === 'checked' && hasBinding) {
        deferredChecked = !!resolveWholeExpr(val, scope);
        continue;
      }

      if (hasBinding) {
        el.setAttribute(name, interpolateString(val, scope));
      } else {
        el.setAttribute(name, val);
      }
    }

    // textarea's bound "value" actually comes through as text content in the source
    // (<textarea onChange="..." >{{formNotes}}</textarea>), handled naturally by the
    // generic child-rendering below; we still tag it for focus restoration.
    if (tag === 'textarea' && !el.hasAttribute('data-focus-key')) {
      var onchangeAttr = tplNode.getAttribute('onchange') || tplNode.getAttribute('onChange');
      if (onchangeAttr) el.setAttribute('data-focus-key', 'ta:' + onchangeAttr);
    }

    var children = renderChildren(tplNode, scope, nextSvgMode);
    for (var c = 0; c < children.length; c++) el.appendChild(children[c]);

    if (deferredValue !== undefined) el.value = deferredValue === null ? '' : deferredValue;
    if (deferredChecked !== undefined) el.checked = deferredChecked;

    return [el];
  }

  function renderChildren(tplNode, scope, svgMode) {
    var out = [];
    var kids = tplNode.childNodes;
    for (var i = 0; i < kids.length; i++) {
      var rendered = renderNode(kids[i], scope, svgMode);
      for (var j = 0; j < rendered.length; j++) out.push(rendered[j]);
    }
    return out;
  }

  function DCLogic(props) {
    this.props = props || {};
    this.state = {};
  }
  DCLogic.prototype.setState = function (patch) {
    Object.assign(this.state, patch);
    this._render();
  };
  DCLogic.prototype.mount = function (rootEl, templateRootEl) {
    this._root = rootEl;
    this._template = templateRootEl;
    this._render();
  };
  DCLogic.prototype._render = function () {
    var vals = this.renderVals();

    // Preserve focus + cursor position across the full re-render.
    var active = document.activeElement;
    var focusInfo = null;
    if (active && this._root.contains(active)) {
      var key = active.getAttribute && active.getAttribute('data-focus-key');
      if (key) {
        focusInfo = { key: key, start: active.selectionStart, end: active.selectionEnd };
      }
    }

    var newChildren = renderChildren(this._template, vals, false);
    this._root.innerHTML = '';
    for (var i = 0; i < newChildren.length; i++) this._root.appendChild(newChildren[i]);

    if (focusInfo) {
      var el = this._root.querySelector('[data-focus-key="' + cssEscape(focusInfo.key) + '"]');
      if (el) {
        el.focus();
        if (typeof el.setSelectionRange === 'function' && focusInfo.start != null && focusInfo.start === focusInfo.end) {
          try { el.setSelectionRange(focusInfo.start, focusInfo.end); } catch (e) { /* ignore */ }
        }
      }
    }
  };

  function cssEscape(s) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(s);
    return s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  }

  global.DCLogic = DCLogic;

  // Boot helper used by every exported page:
  //   dcBoot(Component, 'app-root', 'app-template')
  global.dcBoot = function (ComponentClass, rootId, templateId) {
    var mountEl = document.getElementById(rootId);
    var templateHost = document.getElementById(templateId);
    var templateRoot = templateHost.content ? templateHost.content : templateHost;
    var comp = new ComponentClass({});
    comp.mount(mountEl, templateRoot);
    return comp;
  };
})(window);

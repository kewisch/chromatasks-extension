/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2008-2013 */

"use strict";

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://calendar/modules/calUtils.jsm");

(function () {
  var calendarRuleCache = {};
  var categoryRuleCache = {};

  var  observer = {
    QueryInterface: XPCOMUtils.generateQI([
      Components.interfaces.calICalendarManagerObserver,
      Components.interfaces.calIObserver,
      Components.interfaces.nsIObserver,
    ]),


    // calICalendarManagerObserver
    onCalendarRegistered: function(aCalendar) {
      updateCalendarColor(aCalendar);
    },

    onCalendarUnregistering: function(aCalendar) {
      removeColor(aCalendar.id, calendarRuleCache);
    },

    onCalendarDeleting: function(aCalendar) {},

    // calIObserver
    onStartBatch: function() {},
    onEndBatch: function() {},
    onLoad: function() {},

    onAddItem: function() {},
    onModifyItem: function() {},
    onDeleteItem: function() {},
    onError: function() {},

    onPropertyChanged: function(aCalendar, aName, aValue, aOldValue) {
      switch (aName) {
        case "color":
            updateCalendarColor(aCalendar);
            break;
      }
    },

    onPropertyDeleting: function() {},

    // nsIObserver
    observe: function cto_observe(aSubject, aTopic, aData) {
      try {
        if (aTopic == "nsPref:changed") {
          reloadAllRules();
        }
      } catch (e) {
        Components.utils.reportError(e);
      }
    },
  };

  function getStyleSheet() {
    if (!getStyleSheet.sheet) {
      const cssUri = "chrome://chromatasks/content/chromasheet.css";
      for each (let sheet in document.styleSheets) {
        if (sheet.href == cssUri) {
            getStyleSheet.sheet = sheet;
            break;
        }
      }
    }
    return getStyleSheet.sheet;
  }

  function reloadAllRules() {
    // First remove all rules
    let sheet = getStyleSheet();
    while (sheet.cssRules.length) {
      sheet.deleteRule(0);
    }

    calendarRuleCache = {};
    categoryRuleCache = {};

    // Update calendar color rules
    let calMgr = getCalendarManager();
    let cals = calMgr.getCalendars({});
    for each (let calendar in cals) {
      updateCalendarColor(calendar);
    }

    // Update category color rules
    let categories = Services.prefs.getChildList("calendar.category.color.");
    for each (let cat in categories) {
      var catName = cat.substr(24);
      updateCategoryColor(catName);
    }
  }

  function removeColor(aKey, aCache) {
    var sheet = getStyleSheet();

    if (aKey in aCache) {
      let rule = aCache[aKey];
      for (let i = 0; i < sheet.cssRules.length; i++) {
        if (sheet.cssRules[i] == rule) {
          sheet.cssRules.deleteRule(i);
          delete aCache[aKey];
        }
      }
    }

    updateTree();
  }

  function updateColor(aSelector, aColor, aKey, aCache, aUseBackground) {
    let sheet = getStyleSheet();
    let found = false;

    let thisproperty = (aUseBackground ? "background-color" : "color");
    let otherproperty = (aUseBackground ? "color" : "background-color");

    if (aKey in aCache) {
      let rule = aCache[aKey];
      rule.style.setProperty(thisproperty, aColor, "important");
      rule.style.removeProperty(otherproperty);
    } else {
      let ruleText = aSelector + "{ " + (aUseBackground ? "background-" : "") +
            "color: " + aColor + " !important; }";
      try {
        let ruleIndex = sheet.insertRule(ruleText, sheet.cssRules.length);
        aCache[aKey] = sheet.cssRules[ruleIndex];
      } catch (e) {
        Components.utils.reportError("[chromatasks] Could not add rule: " + ruleText + "\n" + e);
      }
    }

    updateTree();
  }

  function updateCalendarColor(aCalendar) {
    if (cal.getPrefSafe("extensions.chromatasks.colorOf", "calendar") == "calendar") {
      let useBackground = cal.getPrefSafe("extensions.chromatasks.useBackground", false);
      let color = aCalendar.getProperty("color") || "#A8C2E1";
      let pseudoclass = (useBackground ? "-moz-tree-row" : "-moz-tree-cell-text");
      let selector = ".calendar-task-tree > treechildren::" + pseudoclass +
          "(calendarid-" + formatStringForCSSRule(aCalendar.id) + ")";
      updateColor(selector, color, aCalendar.id, calendarRuleCache, useBackground)
    }
  }

  function updateCategoryColor(aCategory) {
    if (cal.getPrefSafe("extensions.chromatasks.colorOf", "calendar") == "category") {
      let useBackground = cal.getPrefSafe("extensions.chromatasks.useBackground", false);
      let color = cal.getPrefSafe("calendar.category.color." + aCategory) || "";
      let pseudoclass = (useBackground ? "-moz-tree-row" : "-moz-tree-cell-text");
      let selector = ".calendar-task-tree > treechildren::" + pseudoclass +
          "(" + aCategory + ")";
      updateColor(selector, color, aCategory, categoryRuleCache, useBackground);
    }
  }

  function updateTree() {
    // Update the tree
    let trees = document.getElementsByTagName("calendar-task-tree");
    for (let i = 0; i < trees.length; i++) {
      // XXX This doesn't work for some reason, we have to live with that now.
      let realtree = document.getAnonymousNodes(trees[i])[0];
      realtree.treeBoxObject.invalidate();
    }
  }

  function load() {
    window.removeEventListener("load", load, false);
    reloadAllRules();

    let calMgr = getCalendarManager();
    calMgr.addObserver(observer);
    calMgr.addCalendarObserver(observer);

    Services.prefs.addObserver("calendar.category.color.", observer, false);
    Services.prefs.addObserver("extensions.chromatasks.", observer, false);
  }

  function unload() {
    window.removeEventListener("unload", unload, false);
    Services.prefs.removeObserver("extensions.chromatasks.", observer, false);

    let calMgr = getCalendarManager();
    calMgr.removeObserver(observer);
    calMgr.removeCalendarObserver(observer);

    Services.prefs.removeObserver("calendar.category.color.", observer);
    Services.prefs.removeObserver("extensions.chromatasks.", observer);
  }

  window.addEventListener("load", load, false);
  window.addEventListener("unload", unload, false);
})();

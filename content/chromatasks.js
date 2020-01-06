/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * Portions Copyright (C) Philipp Kewisch, 2008-2019 */

"use strict";

(function () {
  const ADDON_ID = "{25cf5f06-b211-4df3-9d5a-c0ab253a5561}";
  const DEFAULT_PREFS = {
    colorOf: "calendar",
    useBackground: false
  };

  var { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
  var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
  var { cal } = ChromeUtils.import("resource://calendar/modules/calUtils.jsm");
  var { ExtensionParent } = ChromeUtils.import("resource://gre/modules/ExtensionParent.jsm");

  var calendarRuleCache = {};
  var categoryRuleCache = {};

  var observer = {
    QueryInterface: ChromeUtils.generateQI([Ci.calICalendarManagerObserver, Ci.calIObserver, Ci.nsIObserver]),

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

  async function getPrefs(...args) {
    let extension = ExtensionParent.GlobalManager.getExtension(ADDON_ID);
    let api = await extension.apiManager.asyncGetAPI("storage", extension, "addon_parent");
    let storage = api.getAPI({ extension  }).storage;
    return storage.local.callMethodInParentProcess("get", args);
  }

  async function getStyleSheet() {
    if (!getStyleSheet.sheet) {
      let link = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "link"
      );

      link.setAttribute("id", "chromatasks-styles");
      link.setAttribute("rel", "stylesheet");
      link.setAttribute("type", "text/css");
      link.setAttribute("href", "chrome://chromatasks/content/chromasheet.css");

      await new Promise((resolve) => {
        link.onload = resolve;
        document.documentElement.appendChild(link);
      });

      getStyleSheet.sheet = link.sheet;
    }
    return getStyleSheet.sheet;
  }

  async function reloadAllRules() {
    // First remove all rules
    let sheet = await getStyleSheet();
    while (sheet.cssRules.length) {
      sheet.deleteRule(0);
    }
    debugger;

    calendarRuleCache = {};
    categoryRuleCache = {};

    // Update calendar color rules
    let calMgr = cal.getCalendarManager();
    let cals = calMgr.getCalendars({});
    for (let calendar of cals) {
      updateCalendarColor(calendar);
    }

    // Update category color rules
    let categories = Services.prefs.getChildList("calendar.category.color.");
    for (let cat of categories) {
      let catName = cat.substr(24);
      updateCategoryColor(catName);
    }
  }

  async function removeColor(aKey, aCache) {
    let sheet = await getStyleSheet();

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

  async function updateColor(aSelector, aColor, aKey, aCache, aUseBackground) {
    let sheet = await getStyleSheet();
    let found = false;

    let thisproperty = (aUseBackground ? "background-color" : "color");
    let otherproperty = (aUseBackground ? "color" : "background-color");

    if (aKey in aCache) {
      let rule = aCache[aKey];
      rule.style.setProperty(thisproperty, aColor, "important");
      rule.style.removeProperty(otherproperty);
    } else {
      let ruleText = `${aSelector} { ${aUseBackground ? "background-" : ""}color: ${aColor} !important; }`;
      try {
        let ruleIndex = sheet.insertRule(ruleText, sheet.cssRules.length);
        aCache[aKey] = sheet.cssRules[ruleIndex];
      } catch (e) {
        Cu.reportError(`[chromatasks] Could not add rule: ${ruleText}\n: ${e}`);
      }
    }

    updateTree();
  }

  async function updateCalendarColor(aCalendar) {
    let prefs = await getPrefs(DEFAULT_PREFS);

    if (prefs.colorOf == "calendar") {
      let color = aCalendar.getProperty("color") || "#A8C2E1";
      let pseudoclass = (prefs.useBackground ? "-moz-tree-row" : "-moz-tree-cell-text");
      let selector = ".calendar-task-tree > treechildren::" + pseudoclass +
          "(calendarid-" + cal.view.formatStringForCSSRule(aCalendar.id) + ")";
      await updateColor(selector, color, aCalendar.id, calendarRuleCache, prefs.useBackground)
    }
  }

  async function updateCategoryColor(aCategory) {
    let prefs = await getPrefs(DEFAULT_PREFS);

    if (prefs.colorOf == "category") {
      let color = Services.prefs.getStringPref("calendar.category.color." + aCategory, "") || "";
      let pseudoclass = (prefs.useBackground ? "-moz-tree-row" : "-moz-tree-cell-text");
      let selector = ".calendar-task-tree > treechildren::" + pseudoclass +
          "(" + aCategory + ")";
      await updateColor(selector, color, aCategory, categoryRuleCache, prefs.useBackground);
    }
  }

  function updateTree() {
    // Update the tree
    let trees = document.getElementsByTagName("calendar-task-tree");
    for (let i = 0; i < trees.length; i++) {
      // XXX This doesn't work for some reason, we have to live with that now.
      let realtree = document.getAnonymousNodes(trees[i])[0];
      realtree.invalidate();
    }
  }

  async function load() {
    window.removeEventListener("load", load, false);
    await reloadAllRules();

    let calMgr = cal.getCalendarManager();
    calMgr.addObserver(observer);
    calMgr.addCalendarObserver(observer);

    Services.prefs.addObserver("calendar.category.color.", observer, false);
  }

  async function unload() {
    window.removeEventListener("unload", unload, false);

    let calMgr = cal.getCalendarManager();
    calMgr.removeObserver(observer);
    calMgr.removeCalendarObserver(observer);

    Services.prefs.removeObserver("calendar.category.color.", observer);
  }

  load();
  window.addEventListener("unload", unload, false);
})();

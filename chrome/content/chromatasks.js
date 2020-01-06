/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Chromatasks extension code.
 *
 * The Initial Developer of the Original Code is
 *   Philipp Kewisch <mozilla@kewis.ch>
 * Portions created by the Initial Developer are Copyright (C) 2008-2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

"use strict";

var chromatasks = {
  observer: {
      QueryInterface: function cMO_QueryInterface(aIID) {
        if (!aIID.equals(Components.interfaces.calICalendarManagerObserver) &&
            !aIID.equals(Components.interfaces.calIObserver) &&
            !aIID.equals(Components.interfaces.nsIObserver) &&
            !aIID.equals(Components.interfaces.nsISupports)) {
          throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
      },
      // calICalendarManagerObserver
      onCalendarRegistered: function cMO_onCalendarRegistered(aCalendar) {
        chromatasks.updateColor(aCalendar);
        aCalendar.addObserver(this);
      },

      onCalendarUnregistering: function cMO_onCalendarUnregistering(aCalendar) {
          aCalendar.removeObserver(this);
          chromatasks.removeRule(aCalendar);
      },

      onCalendarDeleting: function cMO_onCalendarDeleting(aCalendar) {
      },

      // calIObserver
      onStartBatch: function() {},
      onEndBatch: function() {},
      onLoad: function() {},

      onAddItem: function() {},
      onModifyItem: function() {},
      onDeleteItem: function() {},
      onError: function() {},

      onPropertyChanged: function cto_onPropertyChanged(aCalendar,
                                                        aName,
                                                        aValue,
                                                        aOldValue) {
        switch (aName) {
          case "color":
              chromatasks.updateColor(aCalendar);
              break;
        }
      },

      onPropertyDeleting: function cto_onPropertyDeleted() {},

      observe: function cto_observe(aSubject, aTopic, aValue) {
          if (aTopic == "nsPref:changed" &&
              aSubject == "extensions.chromatasks.useBackground") {
              // We need to update all rules
              var oldValue = !aValue;
              var calMgr = getCalendarManager();
              var cals = calMgr.getCalendars({});
              for each (var cal in cals) {
                  chromatasks.removeRule(cal, oldValue);
                  chromatasks.updateColor(cal, aValue);
              }
          }
      }
  },

  removeRule: function chromatasks_removeRule(aCalendar, aUseBackground) {
      var sheet = chromatasks.getStyleSheet();
      if (aUseBackground === undefined) {
          // If no option was passed, get from prefs
          aUseBackground = getPrefSafe("extensions.chromatasks.useBackground", false);
      }
      var [selector, bareSelector] = chromatasks.compileSelector(aCalendar, aUseBackground);
      for (var i = 0; i < sheet.cssRules.length; i++) {
          var thisrule = sheet.cssRules[i];
          if (thisrule.selectorText == bareSelector) {
              sheet.deleteRule(i);
          }
      }

      // Update the tree
      var trees = document.getElementsByTagName("calendar-task-tree");
      for (var i = 0; i < trees.length; i++) {
        // XXX This doesn't work for some reason, we have to live with that now.
        var realtree = document.getAnonymousNodes(trees[i])[0];
        realtree.treeBoxObject.invalidate();
      }
  },

  compileSelector: function chromatasks_compileSelector(aCalendar, aUseBackground) {
      var pseudoclass = (aUseBackground ? "-moz-tree-row" : "-moz-tree-cell-text");
      var selector = ".calendar-task-tree > treechildren::" + pseudoclass +
          "(calendarid-" + formatStringForCSSRule(aCalendar.id) + ")";
      return [selector, selector.replace(/[()]/g, "")];
  },

  updateColor: function chromatasks_updateColor(aCalendar, aUseBackground) {
      var sheet = chromatasks.getStyleSheet();
      if (aUseBackground === undefined) {
          // If no option was passed, get from prefs
          aUseBackground = getPrefSafe("extensions.chromatasks.useBackground", false);
      }
      var found = false;

      var thisproperty = (aUseBackground ? "background-color" : "color");
      var otherproperty = (aUseBackground ? "color" : "background-color");
      var [selector, bareSelector] = chromatasks.compileSelector(aCalendar, aUseBackground);

      for (var i = 0; i < sheet.cssRules.length; i++) {
          var thisrule = sheet.cssRules[i];
          if (thisrule.selectorText == bareSelector) {
              thisrule.style.setProperty(thisproperty,
                                         aCalendar.getProperty("color") || "#A8C2E1",
                                         "important");
              thisrule.style.removeProperty(otherproperty);
              found = true;
              break;
          }
      }

      if (!found) {
          var ruleText = selector + "{ " + (aUseBackground ? "background-" : "") + "color: " +
            (aCalendar.getProperty("color") || "#A8C2E1") + " !important; }";
          sheet.insertRule(ruleText, sheet.cssRules.length);
      }

      // Update the tree
      var trees = document.getElementsByTagName("calendar-task-tree");
      for (var i = 0; i < trees.length; i++) {
        // XXX This doesn't work for some reason, we have to live with that now.
        var realtree = document.getAnonymousNodes(trees[i])[0];
        realtree.treeBoxObject.invalidate();
      }
  },

  load: function chromatasks_load() {
    window.removeEventListener("load", chromatasks.load, false);
    var calMgr = getCalendarManager();
    var cals = calMgr.getCalendars({});
    calMgr.addObserver(chromatasks.observer);
    for each (var cal in cals) {
        cal.addObserver(chromatasks.observer);
        chromatasks.updateColor(cal);
    }
  },

  unload: function chromatasks_unload() {
    window.removeEventListener("unload", chromatasks.unload, false);
    var calMgr = getCalendarManager();
    var cals = calMgr.getCalendars({});
    calMgr.removeObserver(chromatasks.observer);
    for each (var cal in cals) {
        cal.removeObserver(chromatasks.observer);
    }
  },

  getStyleSheet: function chromatasks_getStyleSheet() {
    if (!chromatasks.getStyleSheet.sheet) {
        const cssUri = "chrome://chromatasks/content/chromasheet.css";
        for each (var sheet in document.styleSheets) {
            if (sheet.href == cssUri) {
                chromatasks.getStyleSheet.sheet = sheet;
                break;
            }
        }
    }
    return chromatasks.getStyleSheet.sheet;
  }
};

window.addEventListener("load", chromatasks.load, false);
window.addEventListener("unload", chromatasks.unload, false);

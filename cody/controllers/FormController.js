//
// Johan Coppieters - jan 2013 - jWorks
//
//
var mysql = require('mysql');
var cody = require('../index.js');

console.log("loading " + module.id);


FormController.menuList = function( atoms, current ) {
  var root = atoms[cody.Application.kFormRoot];

  var options = "";
  var aList = root.getChildren();
  for (var x in aList) {
    options += "<option value='" + aList[x].id + "'" + ((current.id == aList[x].id) ? " selected" : "") + ">" + aList[x].name + "</option>";
  }
  console.log("current = " + current.id + ", menuPopup -> " + options);
  return options;
}

function FormController(context) {
  console.log("FormController.constructor -> page(" + context.page.itemId + ") = " + context.page.title + ", request = " + context.request);
  
  // init inherited controller
  cody.TreeController.call(this, context);
  
}

FormController.prototype = Object.create( cody.TreeController.prototype );
module.exports = FormController;



FormController.prototype.doRequest = function( finish ) {
  var self = this;
  
  if (self.isRequest("xxx")) {
    // needed ?
    finish("");

  } else {
    cody.TreeController.prototype.doRequest.call(self, finish);
    
  }
};


FormController.prototype.getRoot = function() {
  return cody.Application.kFormRoot;
};
FormController.prototype.getType = function(theNode) { 
  return ((theNode.extention === "xxx") || (theNode.extention === "")) ? "form" : "item";
};
FormController.prototype.getObject = function(id) {
  return this.app.getAtom(id);
};
FormController.prototype.getFolder = function() { 
  return "/forms";
};


/* Overridden - Action functions */
FormController.prototype.emptyLabels = function() {
  var self = this;
  var labels = {};
  for (var iL in self.app.languages) {
    labels[self.app.languages[iL].id] = self.context.atom.name;
  }
  return labels;
};


FormController.prototype.fetchNode = function( theNode, finish ) {
  var self = this;

  cody.TreeController.prototype.fetchNode.call(this, theNode, function() {
    console.log("FormController.FetchNode: node = " + theNode + " -> " + self.context.atom.name + " / " + self.context.atom.extention);

    // get the definitions from the "note" field in the atoms
    var obj = { name: self.context.atom.name, options: {}, labels: self.emptyLabels(), generator: 1 };
    try {
      var tryObj = JSON.parse(self.context.atom.note);
      if ((typeof tryObj !== "undefined") && (tryObj)) { obj = tryObj; }
    } catch(e) {
    }
    self.context.object = obj;

    if (self.context.atom.extention === "") {
      // a form
      finish();

    } else {
      // an item

      // the options below are shown in 2 fields called min/max
      if (obj.generator == cody.Meta.Generator.textareainput) {
        obj.min = obj.options.cols;
        obj.max = obj.options.rows;
      } else {
        obj.min = obj.options.minimum;
        obj.max = obj.options.maximum;
      }
      if (typeof obj.options === "typeof") {
        obj.options = {};
      }
      if ((obj.generator == cody.Meta.Generator.checkboxinput) ||
          (obj.generator == cody.Meta.Generator.selectinput) ||
          (obj.generator == cody.Meta.Generator.radioinput)){
        for (var iC in obj.options.choices) {
          var C = obj.options.choices[iC];
          var X = "";
          for (var iL in C) {
            X += iL + "|" + C[iL] + "\n";
          }
          obj.options.choices[iC] = X.slice(0, -1);
        }
      }
      finish();
    }
  });
};


FormController.prototype.isMultiple = function( aGenerator ) {
  return ((aGenerator === cody.Meta.Generator.checkboxinput) ||
          (aGenerator === cody.Meta.Generator.selectinput) ||
          (aGenerator === cody.Meta.Generator.radioinput));
};

FormController.prototype.saveInfo = function( nodeId, finish ) {
  var self = this;
  console.log("TreeController.saveInfo: node = " + nodeId );

  var anObject = this.getObject(cody.TreeController.toId(nodeId));
  if (typeof anObject !== "undefined") {

    // read the basics for an atom and for an form/item
    anObject.scrapeFrom(this);
    var obj = { name: anObject.name, labels: {} };

    // read the labels in all languages
    for (var iL in self.app.languages) {
      var L = self.app.languages[iL].id;
      obj.labels[L] = this.getParam("label-"+L, "");
    }

    if (anObject.extention === "") {
      // form
      self.context.shownode = anObject.id;
      self.context.opennode = anObject.id;

    } else {
      // item
      self.context.shownode = anObject.parentId;
      self.context.opennode = anObject.parentId;

      var aGenerator = parseInt(self.getParam("generator", cody.Meta.Generator.textinput));
      obj.generator = aGenerator
      obj.options = {};
      obj.reader = cody.Meta.Reader.string;

      var defV = this.getParam("default", "");
      if (defV !== "") {
        obj.options.default = defV;
      }

      if ((this.getParam("required", "N") === "Y") &&
        (aGenerator !== cody.Meta.Generator.checkboxinput)) {
        obj.options.required = true;
      }

      // add validation text or number
      var validation = this.getParam("validation", "X");
      if ((aGenerator === cody.Meta.Generator.textinput) ||
        (aGenerator === cody.Meta.Generator.textarea)) {
        if (validation === "E") {
          obj.options.email = true;
          obj.reader = cody.Meta.Reader.email;
        } else if (validation === "P") {
          obj.options.phone = true;
          obj.reader = cody.Meta.Reader.phone;
        }
      } else if (aGenerator === cody.Meta.Generator.numberinput) {
        obj.options.number = true;
        if (validation === "I") {
          obj.reader = cody.Meta.Reader.integer;
        } else { // === "N"
          obj.reader = cody.Meta.Reader.number;
        }
      }

      // add min/max or cols/rows
      var aMin = self.getParam("min", "");
      var aMax = self.getParam("max", "");
      if (aGenerator === cody.Meta.Generator.textareainput) {
        if (aMin !== "") { obj.options.cols = aMin; }
        if (aMax !== "") { obj.options.rows = aMax; }
      } else if ((aGenerator === cody.Meta.Generator.numberinput) || (aGenerator === cody.Meta.Generator.textinput)) {
        if (aMin !== "") { obj.options.minimum = aMin; }
        if (aMax !== "") { obj.options.maximum = aMax; }
      }

      // add choices in all languages
      if (this.isMultiple(aGenerator)){
        obj.reader = cody.Meta.Reader.multiple;
        obj.options.choices = {};

        for (var iL in self.app.languages) {
          var L = self.app.languages[iL].id;
          obj.options.choices[L] = {};
          var arr = self.getParam("choice-"+L, "").replace("\r", "").split("\n");

          if (arr[0].indexOf("|") > 0) {
            // user has given keys value pairs
            for (var i in arr) {
              var cInx = arr[i].indexOf("|");
              var cID = arr[i].substring(0, cInx);
              obj.options.choices[L][cID] = arr[i].substring(cInx+1);
            }
          } else {
            // no keys, only choices, we'll label them 0, 1, 2 ,...
            for (var i in arr) {
              obj.options.choices[L][i] = arr[i];
            }
          }
        }
      }

      // Date readers
      if (aGenerator === cody.Meta.Generator.dateinput) {
        obj.reader = cody.Meta.Reader.date;
      } else if (aGenerator === cody.Meta.Generator.date3input) {
        obj.reader = cody.Meta.Reader.date3;
      }

    }
    console.log("show / open -> " + self.context.shownode + " / " + self.context.opennode);
    var str = JSON.stringify(obj);
    console.log("Generated Meta: " + str);
    anObject.note = str;
    anObject.doUpdate(self, finish);

  } else {
    this.feedBack(false, "failed to save the data");
    finish();
  }
};


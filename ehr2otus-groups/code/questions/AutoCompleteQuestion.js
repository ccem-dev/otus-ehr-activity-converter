const EhrQuestion = require('./EhrQuestion');

class AutoCompleteQuestion extends EhrQuestion {

    constructor(ehrQuestionObj, pageId){
        super(ehrQuestionObj, pageId, "AutocompleteQuestion", "String");
        this.itemValue = ehrQuestionObj.itemValue;
    }

    toOtusTemplate(){
        let questionObj = this.getOtusStudioQuestionHeader();
        questionObj['dataSources'] = [this.itemValue];
        return questionObj;
    }
}

module.exports = AutoCompleteQuestion;
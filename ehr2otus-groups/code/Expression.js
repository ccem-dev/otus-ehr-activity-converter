const globalVars = require('./globalVars');
const NavigationHandler = require('./NavigationHandler');

const operatorDict = {
    "EQ": "equal",
    "GT": "greater"
};

class Expression {

    constructor(questionId, ehrExpressionObj){
        this.questionId = questionId;
        if(ehrExpressionObj) {
            this.questionName = ehrExpressionObj.questionName;//.
            this.operator = ehrExpressionObj.operator;
            this.value = ehrExpressionObj.value;
            this.isMetadata = (ehrExpressionObj.questionName.includes("Metadata"));
        }
    }

    toJSON(){
        if(this.isMetadata){
            return `${this.questionName} ${this.operator} ${this.value}`;
        }
        return `${this.questionId} ${this.operator} ${this.value}`;
    }

    setValueAndOperator(value, operator="EQ"){
        this.operator = operator;
        this.value = value;
    }

    toOtusTemplate(){
        if(!this.isMetadata) {
            const isNumValue = !isNaN(parseInt(this.value));
            const isBoolValue = (this.value === 'true' || this.value === 'false');
            if(!isNumValue && !isBoolValue){
                this.value = globalVars.choiceGroups.findChoiceLabelInAllChoiceGroup(this.value);
            }
        }
        return NavigationHandler.getExpressionObject(this.questionId, operatorDict[this.operator], this.value, this.isMetadata);
    }

    toJSON(){
        return `${this.questionId} ${this.operator} ${this.value}`;
    }
}

module.exports = Expression;
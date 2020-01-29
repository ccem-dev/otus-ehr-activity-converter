const globalVars = require('./globalVars');

const AutoCompleteQuestion = require('./questions/AutoCompleteQuestion');
const BooleanQuestion = require('./questions/BooleanQuestion');
const DateQuestion = require('./questions/DateQuestion');
const NumericQuestion = require('./questions/NumericQuestion');
const SingleSelectionQuestion = require('./questions/SingleSelectionQuestion');
const TextQuestion = require('./questions/TextQuestion');
const HiddenQuestionGroup = require("./HiddenQuestionGroup");

const NavigationHandler = require('./NavigationHandler');
const Branch = require('./Branch');
const Route = require('./Route');
const Expression = require('./Expression');
const Group = require('./Group');


const OTUS_QUESTIONS_LIST = globalVars.OTUS_TEMPLATE_ATTRIBUTES.QUESTIONS;
const OTUS_NAVIGATION_LIST = globalVars.OTUS_TEMPLATE_ATTRIBUTES.NAVIGATION_LIST;
const OTUS_GROUP_LIST = globalVars.OTUS_TEMPLATE_ATTRIBUTES.GROUPS_LIST;

class QuestionPage {

    constructor(){
        this.id = '';
        this.nextPageId = '';
        this.questions = [];
        this.branches = [];
        this.splitedQuestions = [];
        this.basicQuestionGroups = {};
        this.hiddenQuestions = [];

        this.hiddenIndexes = [];
        this.cutIndexes = [];
        this.routes = {};
        this.groups = [];
    }

    // toJSON(){
    //     return {id: this.id};
    // }

    /*-----------------------------------------------------
     * Getters
     */

    getFirstQuestion(){
        return this.questions[0];
    }

    getLastQuestion(){
        return this.questions[this.questions.length-1];
    }

    _indexOfQuestionById(questionId){
        return _indexOfQuestionByIdInArr(questionId, this.questions);
    }

    _getQuestionsWithHiddenQuestion(){
        return this.questions.filter((q) => q.hiddenQuestion !== undefined);
    }

    _getBasicQuestionGroupThatIncludes(questionId){
        return this.basicQuestionGroups.filter((b) => b.hasQuestion(questionId))[0];
    }

    _getNextQuestionId(questionIndex){
        try{
            return this.questions[questionIndex+1].id;
        }
        catch (e) { // this is the last question => search at next page
            return _getQuestionIdDefaultRouteToNextPage(this.nextPageId);
        }
    }

    /*-----------------------------------------------------
    * Read methods
    */

    readFromJsonObj(ehrQuestionPageObj){
        this.id = ehrQuestionPageObj.id;
        this.nextPageId = ehrQuestionPageObj.nextPageId;

        this._readQuestions(ehrQuestionPageObj.questions);
        this._reorganizeQuestionsThatHiddenQuestion2();

        this._setCutIndexes();

        if(ehrQuestionPageObj.branch){
            this._readRules(ehrQuestionPageObj.branch);
        }
    }

    _readQuestions(questionObjsArr){
        const questionFuncDict = {
            "autocompleteQuestion": AutoCompleteQuestion,
            "booleanQuestion": BooleanQuestion,
            "dateQuestion": DateQuestion,
            "numericQuestion": NumericQuestion,
            "singleSelectionQuestion": SingleSelectionQuestion,
            "textQuestion": TextQuestion
        };
        try {
            for (let questionObj of questionObjsArr) {
                let questionClazz = questionFuncDict[questionObj.type];
                let question = new questionClazz(questionObj, this.id);
                this.questions.push(question);
                globalVars.dictQuestionNameId[question.name] = question.id;

                if (questionObj.basicGroup) {
                   this. _addQuestionInQuestionGroup(question.id, question.basicGroup);
                }

                if(question.hiddenQuestion){
                    this.hiddenQuestions.push({
                        hidden: question.hiddenQuestion.name,
                        hiddenBy: question.id
                    });
                }
            }
        }
        catch (e) {
            console.log(e);
            throw e;
        }
    }

    _addQuestionInQuestionGroup(questionId, basicQuestionGroupId){
        try{
            this.basicQuestionGroups[basicQuestionGroupId].push(questionId);
        }
        catch(e){
            if(this.basicQuestionGroups[basicQuestionGroupId]){
                throw e;
            }
            this.basicQuestionGroups[basicQuestionGroupId] = [questionId];
        }
    }

    _getBasicGroupFirstQuestion(basicQuestionGroupId){
        return this.basicQuestionGroups[basicQuestionGroupId][0];
    }

    _getBasicGroupLastQuestion(basicQuestionGroupId){
        const basicGroup = this.basicQuestionGroups[basicQuestionGroupId];
        return basicGroup[basicGroup.length-1];
    }

    _reorganizeQuestionsThatHiddenQuestion2(){
        for(let hiddenQuestion of this.hiddenQuestions){
            const id = hiddenQuestion.hiddenBy;
            const hiddenQuestionId = globalVars.dictQuestionNameId[hiddenQuestion.hidden];
            const index = this._indexOfQuestionById(id);
            let hiddenIndex = this._indexOfQuestionById(hiddenQuestionId);

            if(hiddenIndex < 0){
                const id = this._getBasicGroupFirstQuestion(hiddenQuestion.hidden);
                hiddenIndex = this._indexOfQuestionById(id);
            }

            if(hiddenIndex === index-1){
                [this.questions[index], this.questions[hiddenIndex]] = [this.questions[hiddenIndex], this.questions[index]];
                hiddenIndex = index;
            }

            this.hiddenIndexes.push(hiddenIndex);
        }
    }

    _setCutIndexes(){
        const lastPageQuestionIndex = this.questions.length-1;
        let groupCutIndexes = [];
        for(let [id,arr] of Object.entries(this.basicQuestionGroups)){
            let n = arr.length;
            if(n > 1){
                const firstIndex = this._indexOfQuestionById(arr[0]);
                if(this.hiddenIndexes.includes(firstIndex)){
                    // console.log(`remove ${firstIndex} from hiddenIndexes`);
                    this.hiddenIndexes = this.hiddenIndexes.filter(x => x !== firstIndex);
                }
                if(firstIndex-1 >= 0){
                    groupCutIndexes.push(firstIndex-1);
                }

                const lastIndex = this._indexOfQuestionById(arr[n-1]);
                if(!this.hiddenIndexes.includes(lastIndex) && lastIndex !== lastPageQuestionIndex){
                    groupCutIndexes.push(lastIndex);
                    // console.log(`cut at index ${lastIndex} after Basic Group ${id}`);//.
                }
            }
        }

        for(let index of this.hiddenIndexes){
            this.cutIndexes.push(index);
            if(index > 0 && !this.cutIndexes.includes(index-1)) {
                this.cutIndexes.push(index - 1);
            }
        }

        this.cutIndexes = this.cutIndexes.filter(x => x < lastPageQuestionIndex && !groupCutIndexes.includes(x))
            .concat(groupCutIndexes).sort();

        //.
        // let str = (this.hiddenIndexes.length === 0 ? "" : "hiddenIndexes =   " + this.hiddenIndexes.join(", ") + '\n');
        // str += (groupCutIndexes.length === 0 ? "" :  "groupCutIndexes = " + groupCutIndexes.join(", ") + '\n');
        // str += (this.cutIndexes.length === 0 ? "" : "cutIndexes =      " + this.cutIndexes.join(", ") + '\n');
        // if(str.length > 0){
        //     console.log('FINAL:\n' + str);
        // }
        //.
    }

    _readRules(ehrBranchArr){        
        for(let ehrBranch of ehrBranchArr) {
            //const branch = new Branch(this.id, ehrBranch);//.
            this.branches.push(new Branch(this.id, ehrBranch));
        }
    }

    /* -----------------------------------------------------
     * After read all questionnaire
     */

    setRoutes(){
        this._setGroups();
        this._setRoutesByCutIndexes();
        this._setRoutesFromBranches();
    }

    _setGroups(){
        // if(this.id === "PAGE_003"){
        //     console.log('debug');
        // }

        const n = this.questions.length;
        let start=0;
        for(let index of this.cutIndexes.concat([n-1])){
            const group = this.questions.slice(start, index+1).map(q => q.id);
            if(group.length >= 2){
                this.groups.push(new Group(group, group[0].basicGroup));
            }
            start = index+1;
        }

        //if(this.groups.length>0) console.log("\n" + this.id + "\n" + JSON.stringify(this.groups, null, 4));//.
    }

    _someGroupContainsQuestion(questionId){
        for(let group of this.groups){
            if(group.containsQuestion(questionId)){
                return group;
            }
        }
    }

    _setRoutesByCutIndexes(){
        const n = this.questions.length;
        for (let i = 0; i < n-1; i++) {
            if(this.hiddenIndexes.includes(i+1)){
                this._addNewRoute(i, i+2);

                let question = this.questions[i];
                const operator = Expression.equalOperator();
                const value = question.hiddenQuestion.isVisibleWhenThisAnswerIs;
                const expression = new Expression(question.id, operator, value);
                this._addNewRoute(i, i+1, [expression]);
            }
            else{
                this._addNewRoute(i, i+1);
            }
        }
        this._addNewRoute(n-1, n);
        
        //console.log(this.id + ":\n" + JSON.stringify(this.routes, null, 2) + '\n');//.
    }

    _setRoutesFromBranches(){
        const pageId = "PAGE_000";//.
        const debug = (this.id === pageId);//.
        if(debug) {
            console.log(this.id + "\ngroups" + this.groups.length + "\n" + JSON.stringify(this.groups, null, 2) + '\n');
            console.log(JSON.stringify(this.routes, null, 2) + '\n');//.
        }//.

        for(let branch of this.branches) {
            let originId =  this.questions[0].id;
            let group = this._someGroupContainsQuestion(originId);
            if(group){
                if(debug) console.log(`initial originId = ${originId}`);//.
                originId = group.getLastQuestion();
            }

            if(debug) console.log(`has group with originId = ${originId}? ${group!==undefined}`);//.

            const targetId = _getQuestionIdDefaultRouteToNextPage(branch.targetPageId);

            if(debug) console.log(`\n${branch.originPageId} (${originId}) -> ${branch.targetPageId} (${targetId})\nrules`);//.

            let conditions = [];

            for(let condition of branch.rules){
                conditions.push(condition.expressions);
                if(debug) console.log(JSON.stringify(condition.expressions, null, 4));//.
            }

            this.routes[originId].push(new Route(originId, targetId, conditions));
        }

        if(debug) console.log("\nagain\n" + JSON.stringify(this.routes, null, 2) + '\n\n');//.
    }

    _addNewRoute(originIndex, targetIndex, conditions){
        const originId = this.questions[originIndex].id;
        const targetId = this._getNextQuestionId(targetIndex-1);// -1 coz method look for arg+1
        try{
            this.routes[originId].push(new Route(originId, targetId, conditions));
        }catch (e) {
            this.routes[originId] = [new Route(originId, targetId, conditions)];
        }
    }

    /* -----------------------------------------------------
     * Conversion To Otus
     */

    toOtusStudioTemplate(otusStudioTemplate){
        //this._reorganizeQuestionsThatHiddenQuestion();

        for(let question of this.questions){
            otusStudioTemplate[OTUS_QUESTIONS_LIST].push(question.toOtusTemplate());
        }

        // if(this.splitedQuestions.length){
        //     this._setNavigationAndGroupListUsingSplitedQuestions(otusStudioTemplate);
        // }
        // else {
            this._addNavigationToOtusTemplate(this.questions, otusStudioTemplate[OTUS_NAVIGATION_LIST]);

            if (this.questions.length > 1) {
                otusStudioTemplate[OTUS_GROUP_LIST].push(this._getOtusGroupListObj());
            }
        // }
    }

    /*
     * Navigation
     */

    _addNavigationToOtusTemplate(questions, navigationList){
        const firstQuestion = questions[0];
        let inNavigation = this._inNavigationArrForFirstQuestion();

        if(questions.length === 1){
            let nextQuestionId = _getQuestionIdDefaultRouteToNextPage(this.nextPageId);
            let routes =  [
                NavigationHandler.getDefaultRouteObj(firstQuestion.id, nextQuestionId)
            ];
            this._pushNonDefaultRoutesOtusObj(questions, routes);
            navigationList.push(_navigationItemListForQuestion(firstQuestion, inNavigation, routes));
            return;
        }

        // First Question: with only 1 route to 2th question
        let routes =  [
            NavigationHandler.getDefaultRouteObj(firstQuestion.id, questions[1].id)
        ];
        navigationList.push(_navigationItemListForQuestion(firstQuestion, inNavigation, routes));

        // Middle Questions
        let endIndex = questions.length-2;
        _addNavigationAtSequence(navigationList, questions, 1, endIndex);

        // Last Question
        const lastQuestion = questions[endIndex+1];
        inNavigation = [
            NavigationHandler.getInNavigationObj(questions[endIndex].id, questions[endIndex].index)
        ];
        let nextQuestionId = _getQuestionIdDefaultRouteToNextPage(this.nextPageId);
        routes =  [
            NavigationHandler.getDefaultRouteObj(lastQuestion.id, nextQuestionId)
        ];
        this._pushNonDefaultRoutesOtusObj(questions, routes);
        navigationList.push(_navigationItemListForQuestion(lastQuestion, inNavigation, routes));
    }


    _inNavigationArrForFirstQuestion(){
        try {
            let prevQuestionPage = globalVars.ehrQuestionnaire.getPreviousQuestionPageOf(this.id);
            let prevQuestion = prevQuestionPage.getLastQuestion();
            return [NavigationHandler.getInNavigationObj(prevQuestion.id, prevQuestion.index)];
        }
        catch (e) {
            const BEGIN_NODE = globalVars.DEFAULT_NODES.BEGIN;
            if(e === BEGIN_NODE){
                return [NavigationHandler.getInNavigationObj(BEGIN_NODE.id, BEGIN_NODE.index)];
            }
            return [];
        }
    }

    /*
     * Groups
     */

    _getOtusGroupListObj() {
        return _getOtusGroupListObjForGroup(this.questions.map((q) => q.id));//<<
    }

    /*
     * Debug
     */

    hasQuestion(questionId){
        return (this.questions.filter(question => question.id === questionId).length > 0);
    }

    resume(){
        let content = this.id + "\n";
        for (let i = 0; i < this.questions.length; i++) {
            const questionId = this.questions[i].id;
            const isHiddenBySomebody = (this.hiddenIndexes.includes(i) ? "\t*h" : "");
            let isInSomeBasicGroup = "";
            for(let [id, arr] of Object.entries(this.basicQuestionGroups)){
                if(arr.includes(questionId)){
                    isInSomeBasicGroup = "\t" + id;
                    break;
                }
            }
            let indexStr = `${i}`;
            indexStr = indexStr.padStart(2, ' ');
            content += `\t(${indexStr})\t${questionId}${isInSomeBasicGroup}${isHiddenBySomebody}\n`;
        }
        return content;
    }

    resumeWithCuts(){
        let content = this.id + "\n";
        for (let i = 0; i < this.questions.length; i++) {
            const questionId = this.questions[i].id;
            const isHiddenBySomebody = (this.hiddenIndexes.includes(i) ? "\t*h" : "");
            let isInSomeBasicGroup = "";
            for(let [id, arr] of Object.entries(this.basicQuestionGroups)){
                if(arr.includes(questionId)){
                    isInSomeBasicGroup = "\t" + id;
                    break;
                }
            }
            let indexStr = `${i}`;
            indexStr = indexStr.padStart(2, ' ');
            content += `\t(${indexStr})\t${questionId}${isInSomeBasicGroup}${isHiddenBySomebody}\n`;

            if(this.cutIndexes.includes(i)){
                content += '\t----------------------------------\n';
            }
        }
        return content;
    }
}

module.exports = QuestionPage;

/***************************************************************
 * Private static functions
 */

function _indexOfQuestionByIdInArr(questionId, questionArr){
    let i=0;
    let found = false;
    while(!found && i <  questionArr.length){
        found = questionArr[i++].id === questionId;
    }
    if(found){
        return i-1;
    }
    return -1;
}

function  _getQuestionIdDefaultRouteToNextPage(nextPageId){
    try {
        return globalVars.ehrQuestionnaire.getFirstQuestionIdFromQuestionPage(nextPageId);
    }
    catch (e) {
        if(e !== globalVars.END_PAGE_ID){
            throw e;
        }
        return globalVars.DEFAULT_NODES.END.id;
    }
}

function _navigationItemListForQuestion(question, inNavigation, routes) {
    return NavigationHandler.getNavigationListQuestionElementObj(question.id, question.index, inNavigation, routes);
}

function _addNavigationDefaulRouteForQuestion(navigationList, originQuestion, destinationQuestionId, prevQuestion){
    let inNavigation = [];
    if(prevQuestion) {
        inNavigation = [
            NavigationHandler.getInNavigationObj(prevQuestion.id, prevQuestion.index)
        ];
    }
    let routes =  [
        NavigationHandler.getDefaultRouteObj(originQuestion.id, destinationQuestionId)
    ];
    navigationList.push(_navigationItemListForQuestion(originQuestion, inNavigation, routes));
}

function _addNavigationAtSequence(navigationList, questions, startIndex, endIndex){
    for (let i = startIndex; i <= endIndex; i++) {
        _addNavigationDefaulRouteForQuestion(navigationList, questions[i], questions[i+1].id, questions[i-1]);
    }
}

function _getOtusGroupListObjForGroup(groupQuestionIds){
    const first = groupQuestionIds[0];
    const last = groupQuestionIds.pop();

    let members = [{
        "id": first,
        "position": "start"
    }];

    for (let i = 1; i < groupQuestionIds.length; i++) {
        members.push({
            "id": groupQuestionIds[i],
            "position": "middle"
        })
    }

    members.push({
        "id": last,
        "position": "end"
    });

    return {
        "objectType": "SurveyItemGroup",
        "start": first,
        "end": last,
        "members": members
    }
}
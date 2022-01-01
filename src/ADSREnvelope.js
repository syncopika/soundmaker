"use strict";
exports.__esModule = true;
var ADSREnvelope = /** @class */ (function () {
    function ADSREnvelope() {
        this.attack = 0;
        this.sustain = 0;
        this.decay = 0;
        this.release = 0;
        this.sustainLevel = 0;
    }
    ADSREnvelope.prototype.updateParams = function (params) {
        for (var param in params) {
            if (param in this) {
                this[param] = params[param];
            }
        }
    };
    // need a type for targetNodeParam
    ADSREnvelope.prototype.applyADSR = function (targetNodeParam, start) {
        // targetNodeParam might be the gain property of a gain node, or a filter node for example
        // the targetNode just needs to have fields that make sense to be manipulated with ADSR
        // i.e. pass in gain.gain as targetNodeParam
        // only assuming node params that are objects (and have a value field)
        var baseParamVal = targetNodeParam.baseValue; // i.e. gain.gain.value. this value will be the max value that the ADSR envelope will cover (the peak of the amplitude)
        // sustainLevel should be the level that the ADSR drops off to after hitting the peak, which is baseParamVal
        var sustainLevel = this.sustainLevel === 0 ? 1 : this.sustainLevel;
        targetNodeParam.cancelAndHoldAtTime(start);
        targetNodeParam.linearRampToValueAtTime(0.0, start);
        targetNodeParam.linearRampToValueAtTime(baseParamVal, start + this.attack);
        targetNodeParam.linearRampToValueAtTime(baseParamVal * sustainLevel, start + this.attack + this.decay);
        targetNodeParam.linearRampToValueAtTime(baseParamVal * sustainLevel, start + this.attack + this.decay + this.sustain);
        return targetNodeParam;
    };
    return ADSREnvelope;
}());
exports.ADSREnvelope = ADSREnvelope;

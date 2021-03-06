import { CalcCascades, IirFilter } from "fili";
import { map } from "rxjs/operators";
import { createPipe } from "../../utils/createPipe";
import {
  SAMPLE_RATE as defaultSamplingRate,
  ORDER as defaultOrder,
  CHARACTERISTIC as defaultCharacteristic
} from "../../constants";

/**
 * @method bandpassFilter
 * Applies a band pass filter to EEG Data. Can be applied to Samples or Chunks. Must provide nbChannels. cutOffFrequencies should be defined in array with the lower bound (highpass) followed by the upper bound (lowpass). cutOffFrequencies will default to 2-50hz.
 * @example { nbChannels = 4, samplingRate = 256, cutOffFrequencies = [2, 50] }
 * @param {Object} options
 * @returns {Observable}
 */

const createHighpassIIR = options => {
  const calc = new CalcCascades();
  const coeffs = calc.highpass({
    ...options,
    Fc: options.cutoffFrequencies[0]
  });
  return new IirFilter(coeffs);
};

const createLowpassIIR = options => {
  const calc = new CalcCascades();
  const coeffs = calc.lowpass({ ...options, Fc: options.cutoffFrequencies[1] });
  return new IirFilter(coeffs);
};

export const bandpassFilter = ({
  nbChannels,
  order = defaultOrder,
  characteristic = defaultCharacteristic,
  cutoffFrequencies = [2, 50],
  samplingRate = defaultSamplingRate,
  Fs = samplingRate,
  BW = 1
} = {}) => source => {
  if (!nbChannels) {
    throw new Error(
      "Please supply nbChannels parameter to bandpassFilter operator"
    );
  }
  const options = {
    order,
    characteristic,
    cutoffFrequencies,
    Fs,
    BW
  };
  const bandpassArray = new Array(nbChannels).fill(0).map(() => ({
    high: createHighpassIIR(options),
    low: createLowpassIIR(options)
  }));
  return createPipe(
    source,
    map(eegObject => {
      const isChunk = Array.isArray(eegObject.data[0]);
      const stepFunction = isChunk ? "multiStep" : "singleStep";
      return {
        ...eegObject,
        data: eegObject.data.map((channel, index) =>
          bandpassArray[index].low[stepFunction](
            bandpassArray[index].high[stepFunction](channel)
          )
        )
      };
    })
  );
};

import { formatInTimeZone } from "date-fns-tz";
import { DELETE_RESPONSE } from "./constants";
import { DeleteScheduleResponse, EachScheduleData, HandleScheduleSequenceDeleteResponse, ScheduleDataMongoResponse, ScheduleKeys, HandleScheduleSequenceAddResponse } from "./types";
const ScheduleDataSchema = require('../models/scheduleDataSchema')

/**
 * For ADDING data to the scheduling ONLY. Recursively finds all subsequent conflicting data then returns the sorted dataset.
 * @param {EachScheduleData} newScheduleData - The new schedule Data to add
 * @param {EachScheduleData[]} conflictingData - The other conflicting data
 * @param {ScheduleDataMongoResponse} originalScheduleData - The original schedule data
 * @returns {EachScheduleData[]} - A promise that resolves to a list of EachScheduleData.
 */
export const handleScheduleSequenceAdd = (newScheduleData: EachScheduleData, conflictingData: EachScheduleData[], originalScheduleData: ScheduleDataMongoResponse): EachScheduleData[] | undefined => {
  const allScheduleDatas: EachScheduleData[] = [newScheduleData];

  if (conflictingData.length === 2) {
    const tempAllData = [...conflictingData];
    const sortedTempData = sortScheduleData(tempAllData);

    const firstEndSplit = (sortedTempData[0].timeTo as string).split(":");
    const lastStartSplit = (sortedTempData[1].timeFrom as string).split(":");
    const firstInMins = (parseInt(firstEndSplit[0]) * 60) + parseInt(firstEndSplit[1]);
    const lastInMins = (parseInt(lastStartSplit[0]) * 60) + parseInt(lastStartSplit[1]);

    if (firstInMins <= lastInMins && sortedTempData[1].position === 0) {

    } else {
      return undefined;
    }
  }

  let date = "";
  const targetKey = originalScheduleData.scheduleKeys.get(newScheduleData.locationID) as ScheduleKeys;
  const tempDate = targetKey.key.split(" ")
  tempDate.pop()
  date = tempDate.join(" ");

  conflictingData.forEach(eachScheduleData => {
    const checkedKeys: Set<string> = new Set()
    checkedKeys.add(eachScheduleData.locationID);
    const allFoundDataSegments = recursivelyFindAllConflictingDataSegments(eachScheduleData, [], checkedKeys, date, originalScheduleData);
    if (allFoundDataSegments !== undefined) {
      allScheduleDatas.push(eachScheduleData, ...allFoundDataSegments)
    }
  });

  const sortedScheduleData = sortScheduleData(allScheduleDatas);

  let i = 0;
  while (i < sortedScheduleData.length) {
    sortedScheduleData[i].position = i % 2;
    sortedScheduleData[i].numColumns = 2;
    i++;
  }

  return sortedScheduleData;
}

/**
 * For re-scheduling the sequence on DELETE only. If a conflicting data is of length 1, check if the conflicting data has any additional conflicts. If it does, 
 * reschedule all conflicting data. If it does not, update the confict to the default position. If the conflicting data is length === 2 , reset their positions.
 * @param {EachScheduleData[]} conflictingData - The data that conflicts with the target to delete. Should NOT include the target data.
 * @param {EachScheduleData} targetData - The target data to delete only.
 * @param {ScheduleDataMongoResponse} originalScheduleData - The original schedule data.
 * @returns {Promise<HandleScheduleSequenceDeleteResponse>} - A promise that resolves to the HandleScheduleSequenceDelete response.
 */
export const handleScheduleSequenceDelete = async (conflictingData : EachScheduleData[], targetData: EachScheduleData, originalScheduleData: ScheduleDataMongoResponse): Promise<HandleScheduleSequenceDeleteResponse> => {
  let sequencedData: EachScheduleData[] = [];
  let filteredScheduleData: ScheduleDataMongoResponse = originalScheduleData;

  const startTimeInMins = (parseInt((conflictingData[0].timeFrom as string).split(':')[0]) * 60) + parseInt((conflictingData[0].timeFrom as string).split(':')[1])
  const duration = conflictingData[0].duration as number
  const targetLocationID = conflictingData[0].locationID;
  const targetKey = originalScheduleData.scheduleKeys.get(targetLocationID) ?? null;

  if (conflictingData.length === 1) {
    if (targetKey !== null) {
      const tempDate = targetKey.key.split(" ")
      tempDate.pop()
      const date = tempDate.join(" ");
      
      const conflicts = identifyNumOfConflicts(targetLocationID, startTimeInMins, date, originalScheduleData.scheduleData, duration)

      // since we are using the original scheduled data, conflicts 1 means that it only conflicts with the one that we removed
      if (conflicts.size === 1) {
        const dataArrayToClear = [targetData, ...conflictingData];
        const sortedDataToClear = sortScheduleData(dataArrayToClear);
        filteredScheduleData = await clearScheduleData(sortedDataToClear, date, originalScheduleData.projectID);

        conflictingData[0].position = 0;
        conflictingData[0].numColumns = 1;
        sequencedData = conflictingData;
      } else {
        let targetID;
        conflicts.forEach(eachLocationID => {
          if (eachLocationID !== conflictingData[0].locationID && eachLocationID !== targetData.locationID) {
            targetID = eachLocationID;
          }
        });
        // get the data for the new one
        if (targetID !== undefined) {
          const otherConflictingDataSegment = findDataSegments(targetID, originalScheduleData.scheduleData, originalScheduleData.scheduleKeys)
          if (otherConflictingDataSegment !== null) {
            conflictingData.push(otherConflictingDataSegment);
            const sortedScheduleData = sortScheduleData(conflictingData);

            filteredScheduleData = await clearScheduleData([...sortedScheduleData, targetData], date, originalScheduleData.projectID);

            sortedScheduleData[0].position = 0;
            sortedScheduleData[0].numColumns = 2;
            sortedScheduleData[1].position = 1;
            sortedScheduleData[1].numColumns = 2;
            sequencedData = sortedScheduleData
          }
        }
      } 
    }
  } else if (conflictingData.length === 2) {
    if (conflictingData.length === 2) {
      if (targetKey !== null) {
        const tempDate = targetKey.key.split(" ")
        tempDate.pop()
        const date = tempDate.join(" ");
  
        filteredScheduleData = await clearScheduleData([...conflictingData, targetData], date, originalScheduleData.projectID);
        const sortedScheduleData = sortScheduleData(conflictingData);

        sortedScheduleData[0].position = 0;
        sortedScheduleData[0].numColumns = 1;
        sortedScheduleData[1].position = 0;
        sortedScheduleData[1].numColumns = 1;
        sequencedData = sortedScheduleData
      }
    }
  }

  return { sequencedData: sequencedData, filteredScheduleData: filteredScheduleData }
}

export const recursivelyFindAllConflictingDataSegments = (targetScheduleData: EachScheduleData, allAdditionalDataSegments: EachScheduleData[], checkedKeys: Set<string>, date: string, originalScheduleData: ScheduleDataMongoResponse): EachScheduleData[] => {
  const startTimeInMins = (parseInt((targetScheduleData.timeFrom as string).split(':')[0]) * 60) + parseInt((targetScheduleData.timeFrom as string).split(':')[1])
  const duration = targetScheduleData.duration as number
  const targetLocationID = targetScheduleData.locationID

  const conflicts = identifyNumOfConflicts(targetLocationID, startTimeInMins, date, originalScheduleData.scheduleData, duration)

  if (conflicts.size === 0) {
    return allAdditionalDataSegments;
  }

  let conflictingLocationID = "";
  conflicts.forEach(locationID => {
    if (!checkedKeys.has(locationID)) {
      conflictingLocationID = locationID;
    }
  });
  if (conflictingLocationID === "") {
    return allAdditionalDataSegments
  }

  const targetDataSegment = findDataSegments(conflictingLocationID, originalScheduleData.scheduleData, originalScheduleData.scheduleKeys);
  
  if (targetDataSegment === null) {
    return allAdditionalDataSegments;
  }
  checkedKeys.add(conflictingLocationID);
  allAdditionalDataSegments.push(targetDataSegment)
  return recursivelyFindAllConflictingDataSegments(targetDataSegment, allAdditionalDataSegments, checkedKeys, date, originalScheduleData)
}

/**
 * Sorts the given schedule data array
 * @param {EachScheduleData[]} unsortedScheduleData - The unsorted schedule data array
 * @returns {EachScheduleData[]} Returns the sorted schedule data array
 */
export const sortScheduleData = (unsortedScheduleData: EachScheduleData[]): EachScheduleData[] => {
  return unsortedScheduleData.sort((a, b) => {
    const aSplit = (a.timeFrom as string).split(":")
    const bSplit = (b.timeFrom as string).split(":")
    const aTimeInMins = (parseInt(aSplit[0]) * 60) + parseInt(aSplit[1]);
    const bTimeInMins = (parseInt(bSplit[0]) * 60) + parseInt(bSplit[1]);

    if (aTimeInMins > bTimeInMins) {
      return 1; 
    } else if (aTimeInMins < bTimeInMins) {
      return -1; 
    } else {
      return 0; 
    }
  })
}

/**
 * Retrieves the data segment ONLY based on the associated target location ID
 * @param {string} targetLocationID 
 * @param {Map<string, EachScheduleData[]>} scheduleData The entire schedule data
 * @param {Map<string, ScheduleKeys>} scheduleKeys The entire schedule keys
 * @returns {EachScheduleData | null} Returns the target schedule data segment ONLY.
 */
export const findDataSegments = (targetLocationID: string, scheduleData: Map<string, EachScheduleData[]>, scheduleKeys: Map<string, ScheduleKeys>): EachScheduleData | null => {
  const targetKey = scheduleKeys.get(targetLocationID) ?? null;

  if (targetKey === null) {
    return null
  } else {
    const targetData = scheduleData.get(targetKey.key) ?? null
    if (targetData === null) {
      return null
    } else {
      let targetScheduleData: EachScheduleData = {} as EachScheduleData;
      targetData.forEach(eachScheduleData => {
        if (eachScheduleData.locationID === targetLocationID){
          targetScheduleData = eachScheduleData;
        }
      });
      return targetScheduleData;
    }
  }
}

/**
 * Identifies the number of conflicts given a target locationID
 * @param {string} targetLocationID - The target location ID 
 * @param {number} startTimeInMins - The target start time in minutes
 * @param {string} date - The date formatted to 'Jan 21st, 2023'
 * @param {Map<string, EachScheduleData[]>} scheduleData - The entire schedule data map
 * @param {number} duration - The target duration
 * @returns {Set<string>} The set of locationIDs that conflict with the target location ID
 */
export const identifyNumOfConflicts = (targetLocationID: string, startTimeInMins: number, date: string, scheduleData: Map<string, EachScheduleData[]>, duration: number): Set<string> => {
  let i = 0;
  const conflictingLocationIDs: Set<string> = new Set();
  let currTime = startTimeInMins;
  while (i < (duration / 30)) {
    const currFormattedTime = `${Math.floor(currTime / 60)}:${(currTime % 60 === 0 ? "00" : currTime % 60)}`
    const key = `${date} ${currFormattedTime}`;
    const hasKey = scheduleData.has(key);
    if (hasKey) {
      const originalData = scheduleData.get(key) as EachScheduleData[];
      originalData.forEach(scheduleData => {
        if (!conflictingLocationIDs.has(scheduleData.locationID) && scheduleData.locationID !== targetLocationID) {
          conflictingLocationIDs.add(scheduleData.locationID);
        }
      });
    }
    currTime = currTime + 30;
    i++
  }
  return conflictingLocationIDs 
}

/**
 * Delete a specific schedule point
 * @param {ScheduleDataMongoResponse} originalScheduleData - The Original Schedule Data
 * @param {string} locationIDToDelete - The delete target locationID
 * @param {number} scheduleDateUnix - The delete target unixtime
 * @returns {Promise<DeleteScheduleResponse>} A promise that resolves to the delete schedule response.
 */
export const handleDeleteSchedule = async (originalScheduleData: ScheduleDataMongoResponse, locationIDToDelete: string, scheduleDateUnix: number): Promise<DeleteScheduleResponse> => {
  if (originalScheduleData.scheduleKeys.has(locationIDToDelete)) {
    const targetKey = originalScheduleData.scheduleKeys.get(locationIDToDelete) as ScheduleKeys;
    if (originalScheduleData.scheduleData.has(targetKey.key)){
      const targetData: EachScheduleData | null = findDataSegments(locationIDToDelete, originalScheduleData.scheduleData, originalScheduleData.scheduleKeys)
      
      if (targetData !== null) {
        let currTimeInMinutes = (parseInt((targetData.timeFrom as string).split(':')[0]) * 60) + parseInt((targetData.timeFrom as string).split(':')[1])
      
        const date = formatInTimeZone(scheduleDateUnix, 'GMT', "PPP");
        // need to delete, and update position + num columns
        const conflictingLocationIDs = identifyNumOfConflicts(locationIDToDelete, currTimeInMinutes, date, originalScheduleData.scheduleData, targetData.duration as number)
  
        const conflictingData: EachScheduleData[] = [];
        conflictingLocationIDs.forEach(eachLocationID => {
          const dataSegment = findDataSegments(eachLocationID, originalScheduleData.scheduleData, originalScheduleData.scheduleKeys)
          if (dataSegment !== null) {
            conflictingData.push(dataSegment);
          }
        });
  
        // if there is no conflicts, just return the filteredScheduleData
        if (conflictingLocationIDs.size === 0) {
          const filteredScheduleData: ScheduleDataMongoResponse = await clearScheduleData([targetData], date, originalScheduleData.projectID);
  
          return {
            status: DELETE_RESPONSE.Success,
            finalScheduleData: filteredScheduleData,
            targetData: targetData,
          }
        } else {
          // get the datas and return after modifying their numColumns and position /LOOK AT THIS
          const { sequencedData, filteredScheduleData } = await handleScheduleSequenceDelete(conflictingData, targetData, originalScheduleData);
          if (sequencedData.length !== 0) {
            const returnScheduleData = await generateFinalScheduleData(sequencedData, filteredScheduleData, date);
            return { 
              status: DELETE_RESPONSE.Success,
              finalScheduleData: returnScheduleData,
              targetData: targetData,
            };
          }
        }
      }
    }
  } 

  return {
    status: DELETE_RESPONSE.NotPerformed,
  }
}

/**
 * Identify time range of the Data
 * @param {EachScheduleData[]} allScheduleDatas A list of Schedule Datas that you want to parse the initial time and the end time of the range.
 * @returns {object} An object containing the initial and end times of the range
 * @property {number} fromInMins - The initial time of the computed range in minutes
 * @property {number} toInMins - The end time of the computed range in minutes
 */
export const clearFromAndTo = (allScheduleDatas: EachScheduleData[]) => {
  const fromArray: number[] = [];
  const toArray: number[] = [];

  allScheduleDatas.forEach(eachScheduleData => {
    const fromSplit = (eachScheduleData.timeFrom as string).split(":");
    const toSplit = (eachScheduleData.timeTo as string).split(":");
    const fromInMins = (parseInt(fromSplit[0]) * 60) + parseInt(fromSplit[1]);
    const toInMins = (parseInt(toSplit[0]) * 60) + parseInt(toSplit[1]);

    fromArray.push(fromInMins);
    toArray.push(toInMins);
  });

  const fromInMins = Math.min(...fromArray);
  const toInMins = Math.max(...toArray);

  return { fromInMins, toInMins }
}

/**
 * Clear Schedule Data for a specific date range.
 * @param {EachScheduleData[]} scheduleData - The entire SORTED schedule data
 * @param {string} formattedDate - The date formatted to 'Jan 21st, 2023 2:30'
 * @param {string} projectID - The projectID used to update the project
 * @returns {Promise<ScheduleDataMongoResponse>} A promise that resolves to the filtered schedule data.
 */
export const clearScheduleData = async (scheduleData: EachScheduleData[], formattedDate: string, projectID: string): Promise<ScheduleDataMongoResponse> => {
  const { fromInMins, toInMins } = clearFromAndTo(scheduleData);
  let clearFrom = fromInMins;
  const clearTo = toInMins

  const keysToUnset = [];

  while (clearFrom < clearTo) {
    const currFormattedTime = `${Math.floor(clearFrom / 60)}:${((clearFrom % 60 === 0) ? "00" : clearFrom % 60)}`
    const key = `${formattedDate} ${currFormattedTime}`;

    keysToUnset.push(key);
    clearFrom = clearFrom + 30;
  }
  const filter = {'projectID': projectID}
  const unsetObj = keysToUnset.reduce((acc, key) => ({ ...acc, [`scheduleData.${key}`]: '' }), {});
  let filteredScheduleData: ScheduleDataMongoResponse 
  filteredScheduleData = await ScheduleDataSchema.findOneAndUpdate(filter, {$unset: unsetObj}, {returnOriginal: false});
  return filteredScheduleData;
}

/**
 * Generate Final Schedule Data. Including all non data segments
 * @param {EachScheduleData[]} sequencedData - New Scheduled Data that has been sequenced.
 * @param {ScheduleDataMongoResponse} scheduleDataToAddTo - The final full Schedule Data to add the data to.
 * @param {string} formattedDate - The date formatted to 'Jan 21st, 2023 2:30'
 * @returns {Promise<ScheduleDataMongoResponse>} A promise that resolves to the filtered schedule data.
 */
export const generateFinalScheduleData = async (sequencedData:EachScheduleData[], scheduleDataToAddTo: ScheduleDataMongoResponse, formattedDate: string): Promise<ScheduleDataMongoResponse> => {
  sequencedData.forEach(eachScheduleData => {
    let alreadySetData = false;
    let currTimeInMinutes = (parseInt((eachScheduleData.timeFrom as String).split(':')[0]) * 60) + parseInt((eachScheduleData.timeFrom as String).split(':')[1]);
    const startTime = JSON.parse(JSON.stringify(currTimeInMinutes));

    const nonDataScheduleSegment = {
      scheduleID: eachScheduleData.scheduleID,
      locationID: eachScheduleData.locationID,
      dataSegment: false,
      position: eachScheduleData.position,
    }
    
    while (currTimeInMinutes < (startTime + (eachScheduleData.duration as number))) {
      const currFormattedTime = `${Math.floor(currTimeInMinutes / 60)}:${(currTimeInMinutes % 60 === 0 ? "00" : currTimeInMinutes % 60)}`
      const key = `${formattedDate} ${currFormattedTime}`;

      const hasKey = scheduleDataToAddTo.scheduleData.has(key);

      if (hasKey) {
        const originalData = scheduleDataToAddTo.scheduleData.get(key) as EachScheduleData[];
        if (alreadySetData) {
          scheduleDataToAddTo.scheduleData.set(key, [...originalData, nonDataScheduleSegment])
        } else {
          scheduleDataToAddTo.scheduleData.set(key, [...originalData, eachScheduleData]);
          alreadySetData = true;
        }
      } else {
        if (alreadySetData) {
          scheduleDataToAddTo.scheduleData.set(key, [nonDataScheduleSegment])
        } else {
          scheduleDataToAddTo.scheduleData.set(key, [eachScheduleData]);
          alreadySetData = true;
        }
      }
      currTimeInMinutes = currTimeInMinutes + 30;
    }
  });
  const finalScheduleData = scheduleDataToAddTo;

  return finalScheduleData;
}
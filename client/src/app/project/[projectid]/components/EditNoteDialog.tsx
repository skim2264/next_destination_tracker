/* eslint-disable @next/next/no-img-element */
import {
  PRIORITY_DEFAULT_STYLE,
  PRIORITY_SELECTED_STYLE,
  FORM_SUBMIT_BUTTON,
  FORM_CANCEL_BUTTON,
  maxNumOfImages,
  REMOVE_IMG_BTN_STYLE,
  UPLOAD_IMG_BTN_STYLE,
} from "@/util/constants";
import { NoteData } from "@/util/models";
import {
  faPerson,
  faPersonWalking,
  faPersonRunning,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Dispatch, FC, SetStateAction, useState } from "react";
import ImageUploading, { ImageListType } from "react-images-uploading";

interface Props {
  noteData: NoteData;
  setNoteDialogToggle: Dispatch<SetStateAction<Boolean>>;
}

const EditNoteDialog: FC<Props> = ({ noteData, setNoteDialogToggle }) => {
  const [noteName, setNoteName] = useState<string>(noteData.noteName);
  const [noteAddress, setNoteAddress] = useState<string>(
    noteData.formattedAddress
  );
  const [noteOpen, setNoteOpen] = useState<string>(
    noteData.openHours === undefined ? "" : noteData.openHours
  );
  const [noteClose, setNoteClose] = useState<string>(
    noteData.closeHours === undefined ? "" : noteData.closeHours
  );
  const [noteMessage, setNoteMessage] = useState<string>(
    noteData.customNote === undefined ? "" : noteData.customNote
  );
  const [priority, setPriority] = useState<string>(noteData.priority);
  const [uploadedImage, setUploadedImage] = useState<ImageListType[]>([]);

  const handleImageUploadChange = (imageList: ImageListType) => {
    setUploadedImage(imageList as never[]);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    // TODO: handle form submit. probably in parent component
    // validation for things that are REQUIRED
    e.preventDefault();
    console.log(e);
  };

  return (
    <>
      <div
        className="absolute h-screen w-screen bg-slate-900/40"
        onClick={() => setNoteDialogToggle(false)}
      />
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[22rem] bg-Background flex flex-col p-4">
        <div className="text-xl font-bold pb-1 underline text-Accent">
          Edit Note
        </div>
        {/* add name prop to each input */}
        <form onSubmit={handleSubmit}>
          <div className="flex flex-row w-full h-auto pb-1">
            <div className="mr-2 w-28 italic">Note Name:</div>
            <input
              type="text"
              value={noteName}
              className="px-2 text-sm w-[calc(100%-7rem)] bg-Background_Lighter capitalize"
              onChange={(e) => setNoteName(e.target.value)}
            />
          </div>
          <div className="flex flex-row w-full h-auto pb-1">
            <div className="mr-2 w-28 italic">Address:</div>
            <input
              type="text"
              value={noteAddress}
              className="px-2 text-sm w-[calc(100%-7rem)] bg-Background_Lighter"
              onChange={(e) => setNoteAddress(e.target.value)}
            />
          </div>
          <div className="flex flex-row w-full h-auto pb-1">
            <div className="mr-2 w-28 italic">Hours:</div>
            <input
              type="time"
              value={noteOpen}
              className="px-2 text-sm w-[calc(((100%-7rem)/2)-0.1275rem)] mr-1 bg-Background_Lighter"
              onChange={(e) => setNoteOpen(e.target.value)}
            />
            <input
              type="time"
              value={noteClose}
              className="px-2 text-sm w-[calc(((100%-7rem)/2)-0.1275rem)] bg-Background_Lighter"
              onChange={(e) => setNoteClose(e.target.value)}
            />
          </div>
          <div className="flex flex-row w-full h-auto pb-1">
            <div className="mr-2 w-28 italic">Message:</div>
            <textarea
              rows={3}
              value={noteMessage}
              placeholder="Enter a custom note"
              className="px-2 text-sm w-[calc(100%-7rem)] resize-none overflow-y-auto bg-Background_Lighter"
              onChange={(e) => setNoteMessage(e.target.value)}
            />
          </div>
          <div className="flex w-full h-auto pb-1">
            <ImageUploading
              value={uploadedImage}
              onChange={handleImageUploadChange}
              maxNumber={maxNumOfImages}
            >
              {({ imageList, onImageUpload, onImageRemoveAll }) => (
                <div className="upload__image-wrapper w-full h-auto items-center flex flex-row">
                  {imageList[0] ? (
                    <button
                      className={`${REMOVE_IMG_BTN_STYLE} bg-SecondaryButton/40`}
                      onClick={onImageRemoveAll}
                    >
                      Remove Image:
                    </button>
                  ) : (
                    <button
                      className={`${UPLOAD_IMG_BTN_STYLE} bg-Accent/40`}
                      onClick={onImageUpload}
                    >
                      Upload Image:
                    </button>
                  )}
                  &nbsp;
                  {imageList[0] ? (
                    imageList.map((image, index) => (
                      <div key={index} className="image-item w-full">
                        <img
                          className="h-24 w-full object-cover"
                          src={image.dataURL}
                          alt="uploaded image"
                          width="200"
                        />
                        <div className="image-item__btn-wrapper"></div>
                      </div>
                    ))
                  ) : (
                    <div className="h-24 w-full" />
                  )}
                </div>
              )}
            </ImageUploading>
          </div>
          <div className="flex flex-row justify-between items-center pt-1">
            <div className="flex flex-row justify-center items-center">
              <div className="pr-2 font-bold text-Accent2">Priority:</div>
              <FontAwesomeIcon
                icon={faPerson}
                size="lg"
                className={
                  priority === "Low"
                    ? PRIORITY_SELECTED_STYLE
                    : PRIORITY_DEFAULT_STYLE
                }
                onClick={() => setPriority("Low")}
              />
              <FontAwesomeIcon
                icon={faPersonWalking}
                size="lg"
                className={
                  priority === "Medium"
                    ? PRIORITY_SELECTED_STYLE
                    : PRIORITY_DEFAULT_STYLE
                }
                onClick={() => setPriority("Medium")}
              />
              <FontAwesomeIcon
                icon={faPersonRunning}
                size="lg"
                className={
                  priority === "High"
                    ? PRIORITY_SELECTED_STYLE
                    : PRIORITY_DEFAULT_STYLE
                }
                onClick={() => setPriority("High")}
              />
            </div>
            <div>
              <button
                type="submit"
                className={`${FORM_SUBMIT_BUTTON} h-10 w-32 mr-2`}
              >
                Submit
              </button>
              <button
                type="button"
                className={`${FORM_CANCEL_BUTTON} h-10 w-24 bg-SecondaryButton/80`}
                onClick={() => setNoteDialogToggle(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};

export default EditNoteDialog;

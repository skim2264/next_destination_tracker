"use client";

import { Dispatch, SetStateAction, createContext, useState } from "react";

interface UserProfileState {
  userID: string;
  userEmail: string;
}

const UserContext = createContext<{
  userProfileState: UserProfileState | {};
  setUserProfileState: Dispatch<SetStateAction<UserProfileState>>;
}>({ userProfileState: {}, setUserProfileState: () => null });

export const UserContextProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [userProfileState, setUserProfileState] = useState({});

  return (
    <UserContext.Provider
      value={{
        userProfileState,
        setUserProfileState,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export default UserContext;

import { FC, Dispatch, SetStateAction } from "react";

interface Props {
  searchText: string;
  setSearchText: Dispatch<SetStateAction<string>>;
  handleSearch: () => void;
}

const SearchBar: FC<Props> = ({ searchText, setSearchText, handleSearch }) => {
  return (
    <div className="flex flex-row p-4">
      <input
        className="w-2/3 mr-2 text-white p-2"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
      />
      <button onClick={() => handleSearch()}>Search</button>
    </div>
  );
};

export default SearchBar;
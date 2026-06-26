import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Library from "@/pages/Library";
import BookEditor from "@/pages/BookEditor";
import Reader from "@/pages/Reader";
import SharedReader from "@/pages/SharedReader";

function App() {
  return (
    <div className="App grain">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/book/:id" element={<BookEditor />} />
          <Route path="/book/:id/read" element={<Reader />} />
          <Route path="/s/:shareId" element={<SharedReader />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" />
    </div>
  );
}

export default App;

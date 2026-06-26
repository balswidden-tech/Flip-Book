import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Library from "@/pages/Library";
import BookEditor from "@/pages/BookEditor";
import Reader from "@/pages/Reader";

function App() {
  return (
    <div className="App grain">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Library />} />
          <Route path="/book/:id" element={<BookEditor />} />
          <Route path="/book/:id/read" element={<Reader />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-center" />
    </div>
  );
}

export default App;

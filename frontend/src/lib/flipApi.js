import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

export const fileUrl = (path) =>
  path ? `${API}/files/${path}` : null;

export const listBooks = () => api.get("/books").then((r) => r.data);
export const getBook = (id) => api.get(`/books/${id}`).then((r) => r.data);
export const createBook = (title) =>
  api.post("/books", { title }).then((r) => r.data);
export const renameBook = (id, title) =>
  api.patch(`/books/${id}`, { title }).then((r) => r.data);
export const deleteBook = (id) => api.delete(`/books/${id}`).then((r) => r.data);
export const uploadPages = (id, files, onProgress) => {
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append("files", f));
  return api
    .post(`/books/${id}/pages`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: onProgress,
    })
    .then((r) => r.data);
};
export const reorderPages = (id, pageIds) =>
  api.put(`/books/${id}/reorder`, { page_ids: pageIds }).then((r) => r.data);
export const deletePage = (id, pageId) =>
  api.delete(`/books/${id}/pages/${pageId}`).then((r) => r.data);

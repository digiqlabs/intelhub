import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8002";

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000
});

const unwrap = (response) => response.data;

export const listCompetitors = async () => {
  const { data } = await client.get("/competitors");
  return Array.isArray(data) ? data : data?.results ?? [];
};

export const listWishlist = async (params = {}) => {
  const { data } = await client.get("/wishlist", { params });
  return Array.isArray(data) ? data : data?.results ?? [];
};

export const getWish = async (wishId) => unwrap(await client.get(`/wishlist/${encodeURIComponent(wishId)}`));

export const createWish = async (payload) => unwrap(await client.post("/wishlist", payload));

export const updateWish = async (wishId, payload) =>
  unwrap(await client.put(`/wishlist/${encodeURIComponent(wishId)}`, payload));

export const deleteWish = async (wishId) => {
  await client.delete(`/wishlist/${encodeURIComponent(wishId)}`);
};

export const patchWishStatus = async (wishId, body) =>
  unwrap(await client.patch(`/wishlist/${encodeURIComponent(wishId)}/status`, body));

export const patchWishVendor = async (wishId, body) =>
  unwrap(await client.patch(`/wishlist/${encodeURIComponent(wishId)}/vendor`, body));

export const patchWishCompetitors = async (wishId, body) =>
  unwrap(await client.patch(`/wishlist/${encodeURIComponent(wishId)}/competitors`, body));

export const patchWishMasterProduct = async (wishId, body) =>
  unwrap(await client.patch(`/wishlist/${encodeURIComponent(wishId)}/master-product`, body));

export const listVendors = async (params = {}) => {
  const { data } = await client.get("/vendors", { params });
  return Array.isArray(data) ? data : data?.results ?? [];
};

export const getVendor = async (vendorId) => unwrap(await client.get(`/vendors/${encodeURIComponent(vendorId)}`));

export const createVendor = async (payload) => unwrap(await client.post("/vendors", payload));

export const updateVendor = async (vendorId, payload) =>
  unwrap(await client.put(`/vendors/${encodeURIComponent(vendorId)}`, payload));

export const deleteVendor = async (vendorId) => {
  await client.delete(`/vendors/${encodeURIComponent(vendorId)}`);
};

export const listMasterProducts = async (params = {}) =>
  unwrap(await client.get("/master-products", { params }));

export const getMasterProduct = async (productId) =>
  unwrap(await client.get(`/master-products/${encodeURIComponent(productId)}`));

export const createMasterProduct = async (payload) => unwrap(await client.post("/master-products", payload));

export const updateMasterProduct = async (productId, payload) =>
  unwrap(await client.put(`/master-products/${encodeURIComponent(productId)}`, payload));

export const deleteMasterProduct = async (productId) => {
  await client.delete(`/master-products/${encodeURIComponent(productId)}`);
};

export const listWishFilters = async () => {
  const [competitors, vendors, masterProducts] = await Promise.all([
    listCompetitors(),
    listVendors(),
    listMasterProducts()
  ]);
  return { competitors, vendors, masterProducts };
};

export const listTags = async (params = {}) => unwrap(await client.get("/tags", { params }));

export const getTag = async (tagSlug) => unwrap(await client.get(`/tags/${encodeURIComponent(tagSlug)}`));

export const createTag = async (payload) => unwrap(await client.post("/tags", payload));

export const updateTag = async (tagSlug, payload) =>
  unwrap(await client.put(`/tags/${encodeURIComponent(tagSlug)}`, payload));

export const patchTagStatus = async (tagSlug, body) =>
  unwrap(await client.patch(`/tags/${encodeURIComponent(tagSlug)}/status`, body));

export const addTagAlias = async (payload) => unwrap(await client.post("/tags/alias", payload));

export const resolveTag = async (input) => unwrap(await client.post("/tags/resolve", { input }));

export const mergeTags = async (payload) => unwrap(await client.post("/tags/merge", payload));

export const assignTags = async (payload) => unwrap(await client.post("/tag-assignments", payload));

export const fetchTopTags = async (params = {}) => unwrap(await client.get("/tags/stats/top", { params }));

export const fetchCooccurringTags = async (params = {}) =>
  unwrap(await client.get("/tags/stats/cooccurrence", { params }));

export const fetchTagCategoryBreakdown = async (params = {}) =>
  unwrap(await client.get("/tags/stats/categories", { params }));

export default client;

const axios = require("axios");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchPlacesText({ query, apiKey }) {
  let all = [];
  let nextPageToken = null;

  do {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/place/textsearch/json",
      {
        params: {
          query,
          key: apiKey,
          pagetoken: nextPageToken || undefined,
        },
      },
    );

    const results = res.data?.results || [];
    all.push(...results);

    nextPageToken = res.data?.next_page_token || null;

    if (nextPageToken) await sleep(2000);
  } while (nextPageToken);

  return all;
}

async function getPlaceDetails({ placeId, apiKey }) {
  const res = await axios.get(
    "https://maps.googleapis.com/maps/api/place/details/json",
    {
      params: {
        place_id: placeId,
        key: apiKey,
        fields:
          "name,formatted_address,formatted_phone_number,international_phone_number,website,url",
      },
    },
  );

  return res.data?.result || {};
}

module.exports = { searchPlacesText, getPlaceDetails };

import { getStore } from "@netlify/blobs";

const store = getStore("buetians-pathsala-content");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

const EMPTY_CONTENT = {
  videos: [],
  drives: [],
  notes: []
};


async function getContent() {
  const data = await store.get("content", {
    type: "json"
  });

  if (!data) {
    return EMPTY_CONTENT;
  }

  return {
    videos: Array.isArray(data.videos) ? data.videos : [],
    drives: Array.isArray(data.drives) ? data.drives : [],
    notes: Array.isArray(data.notes) ? data.notes : []
  };
}


async function saveContent(data) {
  await store.setJSON("content", data);
}


function isAdmin(body) {
  return (
    ADMIN_PASSWORD &&
    body &&
    body.password === ADMIN_PASSWORD
  );
}


function getYouTubeId(url) {
  if (!url) return null;

  const value = String(url).trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) {
    return value;
  }

  try {
    const parsed = new URL(value);

    if (
      parsed.hostname === "youtu.be" ||
      parsed.hostname === "www.youtu.be"
    ) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];

      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) {
        return id;
      }
    }

    if (
      parsed.hostname === "youtube.com" ||
      parsed.hostname === "www.youtube.com" ||
      parsed.hostname === "m.youtube.com"
    ) {
      if (parsed.searchParams.get("v")) {
        const id = parsed.searchParams.get("v");

        if (/^[a-zA-Z0-9_-]{11}$/.test(id)) {
          return id;
        }
      }

      const parts = parsed.pathname
        .split("/")
        .filter(Boolean);

      const types = ["embed", "shorts", "live"];

      if (
        parts.length >= 2 &&
        types.includes(parts[0]) &&
        /^[a-zA-Z0-9_-]{11}$/.test(parts[1])
      ) {
        return parts[1];
      }
    }

    return null;

  } catch {
    return null;
  }
}


function isGoogleDriveUrl(url) {
  try {
    const parsed = new URL(url);

    return (
      parsed.hostname === "drive.google.com" ||
      parsed.hostname === "docs.google.com"
    );

  } catch {
    return false;
  }
}


export default async (request) => {

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };


  if (request.method === "GET") {

    try {

      const content = await getContent();

      return new Response(
        JSON.stringify(content),
        {
          status: 200,
          headers
        }
      );

    } catch (error) {

      console.error(error);

      return new Response(
        JSON.stringify({
          error: "Content load failed"
        }),
        {
          status: 500,
          headers
        }
      );
    }
  }


  if (request.method !== "POST") {

    return new Response(
      JSON.stringify({
        error: "Method not allowed"
      }),
      {
        status: 405,
        headers
      }
    );
  }


  let body;

  try {
    body = await request.json();

  } catch {

    return new Response(
      JSON.stringify({
        error: "Invalid JSON"
      }),
      {
        status: 400,
        headers
      }
    );
  }


  if (body.action === "verifyAdmin") {

    if (!isAdmin(body)) {

      return new Response(
        JSON.stringify({
          success: false
        }),
        {
          status: 401,
          headers
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true
      }),
      {
        status: 200,
        headers
      }
    );
  }


  if (!isAdmin(body)) {

    return new Response(
      JSON.stringify({
        error: "Unauthorized"
      }),
      {
        status: 401,
        headers
      }
    );
  }


  try {

    const content = await getContent();


    if (body.action === "addVideo") {

      const youtubeId = getYouTubeId(body.url);

      if (!youtubeId) {

        return new Response(
          JSON.stringify({
            error: "Invalid YouTube URL"
          }),
          {
            status: 400,
            headers
          }
        );
      }


      content.videos.unshift({
        id: Date.now().toString(),
        title: String(body.title || "YouTube Video").trim(),
        url: String(body.url).trim(),
        youtubeId
      });


      await saveContent(content);

      return new Response(
        JSON.stringify({
          success: true
        }),
        {
          status: 200,
          headers
        }
      );
    }


    if (body.action === "addDrive") {

      if (
        !body.title ||
        !body.url ||
        !isGoogleDriveUrl(body.url)
      ) {

        return new Response(
          JSON.stringify({
            error: "Valid Google Drive URL and title required"
          }),
          {
            status: 400,
            headers
          }
        );
      }


      content.drives.unshift({
        id: Date.now().toString(),
        title: String(body.title).trim(),
        url: String(body.url).trim()
      });


      await saveContent(content);

      return new Response(
        JSON.stringify({
          success: true
        }),
        {
          status: 200,
          headers
        }
      );
    }


    if (body.action === "addNote") {

      if (
        !body.title ||
        !body.content
      ) {

        return new Response(
          JSON.stringify({
            error: "Note title and content required"
          }),
          {
            status: 400,
            headers
          }
        );
      }


      content.notes.unshift({
        id: Date.now().toString(),
        title: String(body.title).trim(),
        content: String(body.content).trim()
      });


      await saveContent(content);

      return new Response(
        JSON.stringify({
          success: true
        }),
        {
          status: 200,
          headers
        }
      );
    }


    if (
      body.action === "deleteVideo" ||
      body.action === "deleteDrive" ||
      body.action === "deleteNote"
    ) {

      if (!body.id) {

        return new Response(
          JSON.stringify({
            error: "ID required"
          }),
          {
            status: 400,
            headers
          }
        );
      }


      if (body.action === "deleteVideo") {

        content.videos =
          content.videos.filter(
            item => item.id !== String(body.id)
          );
      }


      if (body.action === "deleteDrive") {

        content.drives =
          content.drives.filter(
            item => item.id !== String(body.id)
          );
      }


      if (body.action === "deleteNote") {

        content.notes =
          content.notes.filter(
            item => item.id !== String(body.id)
          );
      }


      await saveContent(content);

      return new Response(
        JSON.stringify({
          success: true
        }),
        {
          status: 200,
          headers
        }
      );
    }


    return new Response(
      JSON.stringify({
        error: "Unknown action"
      }),
      {
        status: 400,
        headers
      }
    );


  } catch (error) {

    console.error(error);

    return new Response(
      JSON.stringify({
        error: "Server operation failed"
      }),
      {
        status: 500,
        headers
      }
    );
  }
};

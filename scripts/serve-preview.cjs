const http=require("http");
const fs=require("fs");
const path=require("path");

const host="0.0.0.0";
const port=Number(process.env.PORT || 5000);
const root=path.resolve(process.cwd(),"dist");
const indexFile=path.join(root,"index.html");

const mimeTypes={
  ".html":"text/html; charset=utf-8",
  ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".png":"image/png",
  ".jpg":"image/jpeg",
  ".jpeg":"image/jpeg",
  ".gif":"image/gif",
  ".svg":"image/svg+xml",
  ".webp":"image/webp",
  ".ico":"image/x-icon",
  ".woff":"font/woff",
  ".woff2":"font/woff2",
  ".ttf":"font/ttf",
  ".map":"application/json; charset=utf-8"
};

function sendFile(res,filePath){
  fs.readFile(filePath,(error,data)=>{
    if(error){
      res.writeHead(500,{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"});
      res.end("Guestbook preview could not read this file.");
      return;
    }

    const extension=path.extname(filePath).toLowerCase();
    res.writeHead(200,{
      "Content-Type":mimeTypes[extension] || "application/octet-stream",
      "Cache-Control":"no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma":"no-cache",
      "Expires":"0"
    });
    res.end(data);
  });
}

const server=http.createServer((req,res)=>{
  let pathname;

  try{
    pathname=decodeURIComponent(new URL(req.url,`http://${req.headers.host || "localhost"}`).pathname);
  }catch{
    res.writeHead(400,{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"});
    res.end("Bad request");
    return;
  }

  const requestedPath=path.resolve(root,`.${pathname}`);

  if(requestedPath!==root && !requestedPath.startsWith(`${root}${path.sep}`)){
    res.writeHead(403,{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"});
    res.end("Forbidden");
    return;
  }

  fs.stat(requestedPath,(error,stats)=>{
    if(!error && stats.isFile()){
      sendFile(res,requestedPath);
      return;
    }

    if(!error && stats.isDirectory()){
      const directoryIndex=path.join(requestedPath,"index.html");
      if(fs.existsSync(directoryIndex)){
        sendFile(res,directoryIndex);
        return;
      }
    }

    // Expo Router web routes should load the app shell and resolve client-side.
    sendFile(res,indexFile);
  });
});

server.on("error",error=>{
  console.error("[Guestbook] Preview server failed:",error);
  process.exit(1);
});

server.listen(port,host,()=>{
  console.log(`[Guestbook] Preview ready at http://${host}:${port}`);
  console.log("[Guestbook] Browser caching disabled for preview responses.");
});

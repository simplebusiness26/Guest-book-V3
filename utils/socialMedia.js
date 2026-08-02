import {Platform} from "react-native";

export function fileExtension(asset,mediaType){
  const fileName=asset?.fileName || asset?.name || "";
  if(fileName.includes(".")) return fileName.split(".").pop().toLowerCase();

  const subtype=(asset?.mimeType || "").split("/").pop()?.toLowerCase();
  if(subtype==="jpeg") return "jpg";
  if(subtype==="quicktime") return "mov";
  if(subtype) return subtype;
  return mediaType==="video" ? "mp4" : "jpg";
}

export function assetDurationSeconds(asset){
  const raw=Number(asset?.duration || 0);
  if(!raw) return null;
  return raw>300 ? raw/1000 : raw;
}

export async function resolveVideoDuration(asset){
  const supplied=assetDurationSeconds(asset);
  if(supplied) return supplied;

  if(Platform.OS!=="web" || typeof document==="undefined" || !asset?.uri) return null;

  return new Promise(resolve=>{
    const video=document.createElement("video");
    let finished=false;

    const finish=value=>{
      if(finished) return;
      finished=true;
      clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      resolve(Number.isFinite(value) && value>0 ? value : null);
    };

    const timer=setTimeout(()=>finish(null),5000);
    video.preload="metadata";
    video.onloadedmetadata=()=>finish(Number(video.duration || 0));
    video.onerror=()=>finish(null);
    video.src=asset.uri;
  });
}

export async function uploadSocialAsset({asset,userId,mediaType}){
  const extension=fileExtension(asset,mediaType);
  const random=Math.random().toString(36).slice(2,10);
  const path=`${userId}/${Date.now()}-${random}.${extension}`;
  const response=await fetch(asset.uri);

  if(!response.ok) throw new Error(`The selected ${mediaType} could not be read.`);
  const bytes=await response.arrayBuffer();

  const contentType=asset.mimeType || (mediaType==="video" ? "video/mp4" : `image/${extension}`);

  return {path,bytes,contentType};
}

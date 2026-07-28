const maximumSourceBytes=20*1024*1024;
const maximumImageDimension=2400;
const outputQuality=0.86;

const videoTypes=new Set(['video/mp4','video/webm','video/quicktime']);

export function isVideoUpload(file:File){
  return videoTypes.has(file.type)||/\.(mp4|webm|mov)$/i.test(file.name);
}

export function fitImageWithinBounds(width:number,height:number,maxDimension=maximumImageDimension){
  if(width<=maxDimension&&height<=maxDimension)return {width,height};
  const scale=maxDimension/Math.max(width,height);
  return {width:Math.max(1,Math.round(width*scale)),height:Math.max(1,Math.round(height*scale))};
}

function canvasToBlob(canvas:HTMLCanvasElement){
  return new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Photo could not be prepared securely.')),'image/webp',outputQuality));
}

export async function prepareMediaUpload(file:File){
  if(isVideoUpload(file))return file;
  if(file.size>maximumSourceBytes)throw new Error('Photo is too large to process safely. Maximum source size is 20 MB.');
  if(typeof createImageBitmap!=='function')throw new Error('This browser cannot remove photo metadata. Please use a current browser.');

  let bitmap:ImageBitmap;
  try{
    bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
  }catch{
    throw new Error('This photo format could not be processed safely. Convert it to JPG, PNG, or WebP and try again.');
  }

  try{
    const size=fitImageWithinBounds(bitmap.width,bitmap.height);
    const canvas=document.createElement('canvas');
    canvas.width=size.width;
    canvas.height=size.height;
    const context=canvas.getContext('2d');
    if(!context)throw new Error('Photo could not be prepared securely.');
    context.drawImage(bitmap,0,0,size.width,size.height);
    const blob=await canvasToBlob(canvas);
    const baseName=file.name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]+/g,'-').slice(0,80)||'deal-photo';
    return new File([blob],`${baseName}.webp`,{type:'image/webp',lastModified:Date.now()});
  }finally{
    bitmap.close();
  }
}

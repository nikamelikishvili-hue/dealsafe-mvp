import { useEffect, useRef, useState } from 'react';
import { getAppLanguage } from './i18n';

type PlaceResult={
  displayName?:string;
  formattedAddress?:string;
  fetchFields:(options:{fields:string[]})=>Promise<void>;
};

type PlacePrediction={toPlace:()=>PlaceResult};
type PlaceSelectEvent=Event&{placePrediction:PlacePrediction};

type GooglePlaceAutocompleteElement=HTMLElement&{
  name:string;
  placeholder:string;
  requestedLanguage:string;
  value:string;
};

type PlaceLibrary={
  PlaceAutocompleteElement:new()=>GooglePlaceAutocompleteElement;
};

type GoogleMapsApi={
  maps:{importLibrary:(library:string)=>Promise<PlaceLibrary>};
};

declare global{
  interface Window{
    google?:GoogleMapsApi;
    __dealsafeGoogleMapsReady?:()=>void;
  }
}

let mapsLoader:Promise<void>|null=null;

function loadGoogleMaps(apiKey:string){
  if(window.google?.maps?.importLibrary)return Promise.resolve();
  if(mapsLoader)return mapsLoader;
  mapsLoader=new Promise<void>((resolve,reject)=>{
    const existing=document.querySelector<HTMLScriptElement>('script[data-dealsafe-google-maps]');
    const finish=()=>window.google?.maps?.importLibrary?resolve():reject(new Error('Google Maps did not load'));
    if(existing){existing.addEventListener('load',finish,{once:true});existing.addEventListener('error',()=>reject(new Error('Google Maps did not load')),{once:true});return}
    window.__dealsafeGoogleMapsReady=()=>{resolve();delete window.__dealsafeGoogleMapsReady};
    const script=document.createElement('script');
    script.dataset.dealsafeGoogleMaps='true';
    script.async=true;
    script.src=`https://maps.googleapis.com/maps/api/js?${new URLSearchParams({key:apiKey,v:'weekly',loading:'async',callback:'__dealsafeGoogleMapsReady'})}`;
    script.onerror=()=>{mapsLoader=null;reject(new Error('Google Maps did not load'))};
    document.head.appendChild(script);
  });
  return mapsLoader;
}

export function AddressAutocomplete({value,onChange,placeholder}:{value:string;onChange:(value:string)=>void;placeholder:string}){
  const apiKey=(import.meta.env.VITE_GOOGLE_MAPS_API_KEY||'').trim();
  const hostRef=useRef<HTMLDivElement>(null);
  const elementRef=useRef<GooglePlaceAutocompleteElement|null>(null);
  const onChangeRef=useRef(onChange);
  const [googleReady,setGoogleReady]=useState(false);
  const [googleFailed,setGoogleFailed]=useState(false);

  useEffect(()=>{onChangeRef.current=onChange},[onChange]);

  useEffect(()=>{
    if(!apiKey||!hostRef.current)return;
    let active=true;
    let autocomplete:GooglePlaceAutocompleteElement|null=null;
    const handleInput=()=>autocomplete&&onChangeRef.current(autocomplete.value);
    const handleSelect=async(event:Event)=>{
      const place=(event as PlaceSelectEvent).placePrediction.toPlace();
      await place.fetchFields({fields:['displayName','formattedAddress']});
      if(!active)return;
      const selected=place.formattedAddress||place.displayName||autocomplete?.value||'';
      if(autocomplete)autocomplete.value=selected;
      onChangeRef.current(selected);
    };
    loadGoogleMaps(apiKey).then(async()=>{
      if(!active||!hostRef.current||!window.google)return;
      const {PlaceAutocompleteElement}=await window.google.maps.importLibrary('places');
      if(!active||!hostRef.current)return;
      autocomplete=new PlaceAutocompleteElement();
      autocomplete.name='meeting-address';
      autocomplete.placeholder=placeholder;
      autocomplete.requestedLanguage=getAppLanguage();
      autocomplete.value=value;
      autocomplete.setAttribute('aria-label',placeholder);
      autocomplete.addEventListener('input',handleInput);
      autocomplete.addEventListener('change',handleInput);
      autocomplete.addEventListener('gmp-select',handleSelect);
      hostRef.current.replaceChildren(autocomplete);
      elementRef.current=autocomplete;
      setGoogleReady(true);
    }).catch(()=>active&&setGoogleFailed(true));
    return()=>{
      active=false;
      if(autocomplete){
        autocomplete.removeEventListener('input',handleInput);
        autocomplete.removeEventListener('change',handleInput);
        autocomplete.removeEventListener('gmp-select',handleSelect);
        autocomplete.remove();
      }
      elementRef.current=null;
    };
  },[apiKey,placeholder]);

  useEffect(()=>{if(elementRef.current&&elementRef.current.value!==value)elementRef.current.value=value},[value]);

  if(!apiKey||googleFailed)return <input required placeholder={placeholder} value={value} onChange={event=>onChange(event.target.value)}/>;
  return <div className={`google-address-autocomplete ${googleReady?'ready':'loading'}`}><div ref={hostRef}/>{!googleReady&&<input required placeholder={placeholder} value={value} onChange={event=>onChange(event.target.value)}/>}</div>;
}

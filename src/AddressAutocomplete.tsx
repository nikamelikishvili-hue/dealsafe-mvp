import { useEffect, useRef, useState } from 'react';
import { getAppLanguage } from './i18n';

type PlaceResult={
  displayName?:string;
  formattedAddress?:string;
  addressComponents?:Array<{longText?:string;shortText?:string;types?:string[]}>;
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

export type AddressParts={streetAddress?:string;city?:string;country?:string};

export function AddressAutocomplete({value,onChange,placeholder,onAddressParts}:{value:string;onChange:(value:string)=>void;placeholder:string;onAddressParts?:(parts:AddressParts)=>void}){
  const apiKey=(import.meta.env.VITE_GOOGLE_MAPS_API_KEY||'').trim();
  const hostRef=useRef<HTMLDivElement>(null);
  const elementRef=useRef<GooglePlaceAutocompleteElement|null>(null);
  const inputValueRef=useRef(value);
  const onChangeRef=useRef(onChange);
  const onAddressPartsRef=useRef(onAddressParts);
  const [googleReady,setGoogleReady]=useState(false);
  const [googleFailed,setGoogleFailed]=useState(false);

  useEffect(()=>{onChangeRef.current=onChange;onAddressPartsRef.current=onAddressParts},[onChange,onAddressParts]);

  useEffect(()=>{
    if(!apiKey||!hostRef.current)return;
    let active=true;
    let autocomplete:GooglePlaceAutocompleteElement|null=null;
    const handleInput=()=>{if(!autocomplete)return;inputValueRef.current=autocomplete.value;onChangeRef.current(autocomplete.value)};
    const handleSelect=async(event:Event)=>{
      const place=(event as PlaceSelectEvent).placePrediction.toPlace();
      await place.fetchFields({fields:['displayName','formattedAddress','addressComponents']});
      if(!active)return;
      const selected=place.formattedAddress||place.displayName||autocomplete?.value||'';
      const components=place.addressComponents||[];
      const component=(...types:string[])=>{const item=components.find(entry=>types.some(type=>entry.types?.includes(type)));return item?.longText||item?.shortText||''};
      const selectedStreetPart=selected.split(',')[0]?.trim()||selected;
      const leadingNumber=(text:string)=>text.match(/^\s*(\d+[A-Za-z]?(?:\s*[-/]\s*\d+[A-Za-z]?)?)(?:\s|$)/)?.[1]||'';
      const streetNumber=component('street_number')||leadingNumber(selectedStreetPart)||leadingNumber(inputValueRef.current);
      const route=component('route');
      const streetAddress=route?[streetNumber,route].filter(Boolean).join(' ').trim():selectedStreetPart;
      const city=component('locality','postal_town','sublocality_level_1','administrative_area_level_2');
      const country=component('country');
      if(autocomplete)autocomplete.value=streetAddress;
      inputValueRef.current=streetAddress;
      onChangeRef.current(streetAddress);
      onAddressPartsRef.current?.({streetAddress,city,country});
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

  useEffect(()=>{inputValueRef.current=value;if(elementRef.current&&elementRef.current.value!==value)elementRef.current.value=value},[value]);

  if(!apiKey||googleFailed)return <input required placeholder={placeholder} value={value} onChange={event=>onChange(event.target.value)}/>;
  return <div className={`google-address-autocomplete ${googleReady?'ready':'loading'}`}><div ref={hostRef}/>{!googleReady&&<input required placeholder={placeholder} value={value} onChange={event=>onChange(event.target.value)}/>}</div>;
}

import {useState} from 'react';
export function useRecent(){const [items,setItems]=useState<string[]>(()=>JSON.parse(localStorage.getItem('recent-iocs')??'[]'));const add=(value:string)=>{const next=[value,...items.filter(x=>x!==value)].slice(0,8);setItems(next);localStorage.setItem('recent-iocs',JSON.stringify(next))};return {items,add}}


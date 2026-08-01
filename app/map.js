import React, { useEffect, useState } from "react";

import {
StyleSheet,
View,
TextInput,
Pressable,
Text
} from "react-native";

import MapView, { Marker } from "react-native-maps";

import { router } from "expo-router";

import { supabase } from "../services/supabase";


export default function MapScreen(){


const [businesses,setBusinesses] = useState([]);

const [properties,setProperties] = useState([]);

const [search,setSearch] = useState("");

const [category,setCategory] = useState("");



useEffect(()=>{

loadPlaces();

},[]);



async function loadPlaces(){


const {data:businessData,error:businessError}=await supabase

.from("businesses")

.select("*");



const {data:propertyData,error:propertyError}=await supabase

.from("properties")

.select("*");



if(businessError){

console.log(businessError);

}


if(propertyError){

console.log(propertyError);

}



setBusinesses(businessData || []);

setProperties(propertyData || []);


}



const filteredBusinesses = businesses.filter(place=>{


const searchMatch =
place.name
?.toLowerCase()
.includes(search.toLowerCase());


const categoryMatch =
category === "" ||
place.category === category;


return searchMatch && categoryMatch;


});



const filteredProperties = properties.filter(place=>{


const searchMatch =
place.name
?.toLowerCase()
.includes(search.toLowerCase());


return searchMatch;


});



return(

<View style={styles.container}>


<View style={styles.top}>


<TextInput

style={styles.search}

placeholder="Search places..."

value={search}

onChangeText={setSearch}

/>



<View style={styles.buttons}>


{["Pub","Cafe","Restaurant"].map(item=>(


<Pressable

key={item}

style={styles.button}

onPress={()=>{

if(category===item){

setCategory("");

}else{

setCategory(item);

}

}}

>

<Text>
{item}
</Text>

</Pressable>


))}


</View>


</View>



<MapView

style={styles.map}

initialRegion={{

latitude:50.8225,

longitude:-0.1372,

latitudeDelta:0.05,

longitudeDelta:0.05

}}

>


{filteredBusinesses.map(place=>(


<Marker

key={`business-${place.id}`}

coordinate={{

latitude:place.latitude,

longitude:place.longitude

}}

title={place.name}

description={place.category}

onPress={()=>router.push(`/business/${place.id}`)}

/>


))}



{filteredProperties.map(place=>(


<Marker

key={`property-${place.id}`}

coordinate={{

latitude:place.latitude,

longitude:place.longitude

}}

title={place.name}

description="Property"

onPress={()=>router.push(`/property/${place.id}`)}

/>


))}


</MapView>


</View>

);

}



const styles=StyleSheet.create({

container:{
flex:1
},

map:{
flex:1
},

top:{
position:"absolute",
top:40,
width:"100%",
zIndex:10,
padding:10
},

search:{
backgroundColor:"white",
padding:15,
borderRadius:10
},

buttons:{
flexDirection:"row",
marginTop:10
},

button:{
backgroundColor:"white",
padding:10,
marginRight:5,
borderRadius:10
}

});
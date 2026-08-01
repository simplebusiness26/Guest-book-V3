import React, {useEffect, useState} from "react";

import {
View,
Text,
StyleSheet,
Pressable,
TextInput,
ScrollView,
} from "react-native";

import {router} from "expo-router";
import {supabase} from "../services/supabase";


export default function MapScreen(){


const [businesses,setBusinesses]=useState([]);
const [properties,setProperties]=useState([]);

const [search,setSearch]=useState("");
const [category,setCategory]=useState("");



useEffect(()=>{

loadPlaces();

},[]);





async function loadPlaces(){


const {
data:businessData
}=await supabase

.from("businesses")

.select("*");



const {
data:propertyData
}=await supabase

.from("properties")

.select("*");



setBusinesses(businessData || []);

setProperties(propertyData || []);


}







const filteredBusinesses = businesses.filter(place=>{


const matchesSearch =
place.name
?.toLowerCase()
.includes(search.toLowerCase());



const matchesCategory =
category === "" ||
place.category === category;



return matchesSearch && matchesCategory;


});







return(


<ScrollView

style={styles.container}

contentContainerStyle={{
paddingBottom:40
}}

>


<Text style={styles.title}>
🗺️ Guestbook
</Text>




<TextInput

style={styles.search}

placeholder="Search places..."

value={search}

onChangeText={setSearch}

/>





<ScrollView

horizontal

showsHorizontalScrollIndicator={false}

style={styles.categories}

>


{["Pub","Cafe","Restaurant"].map(item=>(


<Pressable

key={item}

style={styles.category}

onPress={()=>


setCategory(
category===item ? "" : item
)

}

>

<Text>
{item}
</Text>


</Pressable>


))}


</ScrollView>





<Text style={styles.section}>
Businesses
</Text>





{filteredBusinesses.map(place=>(


<Pressable

key={place.id}

style={styles.card}

onPress={()=>


router.push(`/business/${place.id}`)


}

>


<Text style={styles.name}>
📍 {place.name}
</Text>


<Text>
{place.category}
</Text>


<Text>
{place.address}
</Text>


</Pressable>


))}







<Text style={styles.section}>
Properties
</Text>






{properties.map(property=>(


<Pressable

key={property.id}

style={styles.card}

onPress={()=>


router.push(`/property/${property.id}`)


}

>


<Text style={styles.name}>
🏠 {property.name}
</Text>


<Text>
{property.host}
</Text>


<Text>
{property.address}
</Text>


</Pressable>


))}






</ScrollView>


);

}







const styles=StyleSheet.create({


container:{
flex:1,
padding:20
},


title:{
fontSize:30,
fontWeight:"bold"
},


search:{
borderWidth:1,
borderRadius:10,
padding:15,
marginTop:20
},


categories:{
marginTop:15,
maxHeight:50
},


category:{
borderWidth:1,
borderRadius:20,
padding:10,
marginRight:10
},


section:{
fontSize:22,
fontWeight:"bold",
marginTop:25
},


card:{
borderWidth:1,
borderRadius:10,
padding:15,
marginTop:10
},


name:{
fontSize:18,
fontWeight:"bold"
}


});
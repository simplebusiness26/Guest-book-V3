import React, { useState, useCallback } from "react";

import {
View,
Text,
StyleSheet,
ScrollView,
Pressable,
ActivityIndicator
} from "react-native";

import { router } from "expo-router";

import { useFocusEffect } from "expo-router";

import { supabase } from "../../services/supabase";

export default function ManagerDashboard(){

const [loading,setLoading]=useState(true);

const [businesses,setBusinesses]=useState([]);

const [properties,setProperties]=useState([]);

const [user,setUser]=useState(null);

useFocusEffect(

useCallback(()=>{

loadDashboard();

},[])

);

async function loadDashboard(){

setLoading(true);

const {

data:{
user

}

}=await supabase.auth.getUser();

if(!user){

setLoading(false);

return;

}

setUser(user);

const {

data:businessData,
error:businessError

}=await supabase

.from("businesses")

.select("*")

.eq("owner_id",user.id);



if(businessError){

console.log(businessError);

}

const {

data:propertyData,
error:propertyError

}=await supabase

.from("properties")

.select("*")

.eq("owner_id",user.id)

.order("created_at",{ascending:false});

if(propertyError){

console.log(propertyError);

}

setBusinesses(businessData || []);

setProperties(propertyData || []);

setLoading(false);

}

if(loading){

return(

<View style={styles.loading}>

<ActivityIndicator size="large"/>

<Text style={{marginTop:20}}>
Loading Dashboard...
</Text>

</View>

);

}

return(

<ScrollView

style={styles.container}

contentContainerStyle={{

paddingBottom:40

}}

>

<Text style={styles.title}>

Manager Dashboard

</Text>

<Text style={styles.subtitle}>

Manage everything from one place.

</Text>

<View style={styles.section}>

<Text style={styles.sectionTitle}>

🏪 Businesses ({businesses.length})

</Text>

{

businesses.length===0

?

(

<View style={styles.emptyCard}>

<Text style={styles.emptyTitle}>

No businesses yet

</Text>

<Text style={styles.emptyText}>

Create your first business listing.

</Text>

</View>

)

:

(

businesses.map((business)=>(

<View

key={business.id}

style={styles.card}

>

<Text style={styles.cardTitle}>

{business.name}

</Text>

<Text style={styles.cardSub}>

{business.category}

</Text>

<Pressable

style={styles.button}

onPress={()=>router.push(`/business/edit/${business.id}`)}

>

<Text style={styles.buttonText}>

Manage Business

</Text>

</Pressable>

<Pressable

style={styles.button}

onPress={()=>router.push(`/business/${business.id}`)}

>

<Text style={styles.buttonText}>

View Public Profile

</Text>

</Pressable>

</View>

))

)

}

<Pressable

style={styles.addButton}

onPress={()=>router.push("/business/add")}

>

<Text style={styles.buttonText}>

➕ Add Business

</Text>

</Pressable>

</View>

<View style={styles.section}>

<Text style={styles.sectionTitle}>

🏠 Properties ({properties.length})

</Text>

{

properties.length===0

?

(

<View style={styles.emptyCard}>

<Text style={styles.emptyTitle}>
No properties yet
</Text>

<Text style={styles.emptyText}>
Create your first property listing.
</Text>

</View>

)

:

(

properties.map((property)=>(

<View

key={property.id}

style={styles.card}

>

<Text style={styles.cardTitle}>
{property.name}
</Text>

<Text style={styles.cardSub}>
{property.address}
</Text>

<Pressable

style={styles.button}

onPress={()=>router.push(`/property/edit/${property.id}`)}

>

<Text style={styles.buttonText}>
Manage Property
</Text>

</Pressable>

<Pressable

style={styles.button}

onPress={()=>router.push(`/property/${property.id}`)}

>

<Text style={styles.buttonText}>
View Public Profile
</Text>

</Pressable>

</View>

))

)

}

<Pressable

style={styles.addButton}

onPress={()=>router.push("/property/add")}

>

<Text style={styles.buttonText}>
➕ Add Property
</Text>

</Pressable>

</View>

<View style={styles.upgradeCard}>

<Text style={styles.sectionTitle}>
🎯 Activities
</Text>

<Text style={styles.emptyText}>
Upgrade to unlock Activities.
</Text>

</View>

<View style={styles.upgradeCard}>

<Text style={styles.sectionTitle}>
🎉 Events
</Text>

<Text style={styles.emptyText}>
Upgrade to unlock Events.
</Text>

</View>

<View style={styles.upgradeCard}>

<Text style={styles.sectionTitle}>
📈 Analytics
</Text>

<Text style={styles.emptyText}>
Upgrade to unlock Analytics.
</Text>

</View>

</ScrollView>

);

}

const styles=StyleSheet.create({

container:{
flex:1,
backgroundColor:"#f5f7fb",
padding:20
},

loading:{
flex:1,
justifyContent:"center",
alignItems:"center"
},

title:{
fontSize:32,
fontWeight:"bold",
marginTop:10
},

subtitle:{
fontSize:16,
color:"#666",
marginBottom:25,
marginTop:5
},

section:{
marginBottom:30
},

sectionTitle:{
fontSize:24,
fontWeight:"bold",
marginBottom:15
},

card:{
backgroundColor:"white",
padding:18,
borderRadius:14,
marginBottom:15,
borderWidth:1,
borderColor:"#e5e5e5"
},

cardTitle:{
fontSize:20,
fontWeight:"bold"
},

cardSub:{
fontSize:15,
color:"#666",
marginTop:5,
marginBottom:15
},

button:{
backgroundColor:"#222",
padding:14,
borderRadius:10,
marginTop:10
},

addButton:{
backgroundColor:"#0066ff",
padding:16,
borderRadius:12,
marginTop:10
},

buttonText:{
color:"white",
textAlign:"center",
fontWeight:"bold"
},

emptyCard:{
backgroundColor:"white",
padding:20,
borderRadius:14,
borderWidth:1,
borderColor:"#e5e5e5"
},

emptyTitle:{
fontSize:18,
fontWeight:"bold"
},

emptyText:{
fontSize:15,
color:"#666",
marginTop:8
},

upgradeCard:{
backgroundColor:"#fff8e7",
padding:20,
borderRadius:14,
marginBottom:15,
borderWidth:1,
borderColor:"#f0d78c"
}

});
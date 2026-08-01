import React,{useEffect,useState} from "react";

import {
View,
Text,
StyleSheet,
ScrollView,
Image,
Pressable,
ActivityIndicator
} from "react-native";

import {
useLocalSearchParams,
router
} from "expo-router";

import {supabase} from "../../services/supabase";



export default function ProfilePage(){


const {id}=useLocalSearchParams();


const [profile,setProfile]=useState(null);

const [reviews,setReviews]=useState([]);

const [businesses,setBusinesses]=useState([]);

const [loading,setLoading]=useState(true);

const [error,setError]=useState("");





useEffect(()=>{

loadAll();

},[]);





async function loadAll(){


await loadProfile();

await loadReviews();

await loadBusinesses();


setLoading(false);

}







async function loadProfile(){


const {
data,
error
}=await supabase

.from("profiles")

.select("*")

.eq("id",id)

.single();



if(error){

setError(error.message);

return;

}



setProfile(data);


}








async function loadReviews(){


const {
data,
error
}=await supabase

.from("reviews")

.select("*")

.eq("user_id",id)

.order(
"created_at",
{
ascending:false
}
);



if(error){

setError(error.message);

return;

}



setReviews(data || []);


}








async function loadBusinesses(){


const {
data,
error
}=await supabase

.from("businesses")

.select("id,name,category")

.eq("owner_id",id);



if(error){

setError(error.message);

return;

}



setBusinesses(data || []);


}








if(loading){

return(

<View style={styles.center}>

<ActivityIndicator size="large"/>

</View>

);

}







if(error){

return(

<View style={styles.center}>

<Text>
{error}
</Text>

</View>

);

}






if(!profile){

return(

<View style={styles.center}>

<Text>
Profile not found
</Text>

</View>

);

}








return(

<ScrollView style={styles.container}>


<View style={styles.header}>


{

profile.profile_photo

?

<Image

source={{
uri:profile.profile_photo
}}

style={styles.avatar}

/>

:

<View style={styles.avatarFallback}>

<Text style={styles.avatarLetter}>
{profile.full_name?.charAt(0) || "?"}
</Text>

</View>

}




<Text style={styles.name}>
{profile.full_name || "explorer"}
</Text>




<View style={styles.badge}>

<Text style={styles.badgeText}>
{profile.account_type || "explorer"}
</Text>

</View>



</View>








<View style={styles.card}>


<Text style={styles.heading}>
About
</Text>


<Text>
{profile.bio || "No bio added yet"}
</Text>


</View>







<View style={styles.row}>


<View style={styles.stat}>

<Text style={styles.number}>
{reviews.length}
</Text>

<Text>
Reviews
</Text>

</View>



<View style={styles.stat}>

<Text style={styles.number}>
{businesses.length}
</Text>

<Text>
Businesses
</Text>

</View>



</View>







<View style={styles.card}>

<Text style={styles.heading}>
Reviews
</Text>


{
reviews.length === 0

?

<Text>
No reviews written yet
</Text>


:

reviews.map(review=>(

<View

key={review.id}

style={styles.review}

>

<Text>
⭐ {review.rating}/5
</Text>


<Text>
{review.comment}
</Text>


<Text style={styles.reviewDate}>
{new Date(review.created_at).toLocaleDateString("en-GB",{
day:"numeric",
month:"short",
year:"numeric"
})}
</Text>


</View>

))

}


</View>








<View style={styles.card}>


<Text style={styles.heading}>
Businesses
</Text>



{

businesses.length===0

?

<Text>
No businesses yet
</Text>

:

businesses.map(business=>(

<Pressable

key={business.id}

style={styles.businessCard}

onPress={()=>router.push(`/business/${business.id}`)}

>

<Text style={styles.businessName}>
{business.name}
</Text>

<Text style={styles.businessCategory}>
{business.category}
</Text>

<Text style={styles.businessLink}>
View listing →
</Text>

</Pressable>

))

}



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


center:{
flex:1,
justifyContent:"center",
alignItems:"center"
},


header:{
alignItems:"center",
marginBottom:25
},


avatar:{
width:130,
height:130,
borderRadius:65
},

avatarFallback:{
width:130,
height:130,
borderRadius:65,
justifyContent:"center",
alignItems:"center",
backgroundColor:"#0066ff"
},

avatarLetter:{
fontSize:50,
fontWeight:"bold",
color:"white"
},


name:{
fontSize:32,
fontWeight:"bold",
marginTop:15
},


badge:{
marginTop:10,
paddingHorizontal:15,
paddingVertical:6,
borderRadius:20
},


badgeText:{
fontWeight:"bold"
},


card:{
backgroundColor:"white",
padding:20,
borderRadius:15,
marginBottom:15
},


heading:{
fontSize:22,
fontWeight:"bold",
marginBottom:15
},


row:{
flexDirection:"row",
gap:15,
marginBottom:15
},


stat:{
flex:1,
backgroundColor:"white",
padding:20,
borderRadius:15,
alignItems:"center"
},


number:{
fontSize:28,
fontWeight:"bold"
},


review:{
borderTopWidth:1,
borderColor:"#eee",
paddingTop:15,
marginTop:15
},
businessCard:{
backgroundColor:"#f8fafc",
padding:15,
borderRadius:12,
marginBottom:10
},

businessName:{
fontSize:18,
fontWeight:"bold"
},

businessCategory:{
marginTop:5,
color:"#667085"
},

businessLink:{
marginTop:8,
color:"#0066ff",
fontWeight:"bold"
},


business:{
fontSize:18,
paddingVertical:10
}

});
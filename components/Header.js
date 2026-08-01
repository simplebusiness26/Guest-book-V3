import React from "react";

import {
View,
Text,
Pressable,
StyleSheet
} from "react-native";

import {router, usePathname} from "expo-router";


export default function Header(){


const pathname = usePathname();



function goBack(){

if(pathname !== "/"){

router.back();

}

}



return(

<View style={styles.container}>


<Pressable

style={styles.sideButton}

onPress={goBack}

>

<Text style={styles.icon}>
←
</Text>

</Pressable>



<Text style={styles.title}>
Guestbook
</Text>



<Pressable

style={styles.sideButton}

onPress={()=>router.push("/menu")}

>

<Text style={styles.icon}>
☰
</Text>

</Pressable>


</View>

);

}



const styles=StyleSheet.create({

container:{
height:60,
flexDirection:"row",
alignItems:"center",
justifyContent:"space-between",
paddingHorizontal:20,
borderBottomWidth:1,
borderColor:"#ddd"
},


sideButton:{
width:40,
height:40,
alignItems:"center",
justifyContent:"center"
},


icon:{
fontSize:28,
fontWeight:"bold"
},


title:{
fontSize:22,
fontWeight:"bold"
}


});
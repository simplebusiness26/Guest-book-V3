import React,{useState} from "react";
import {
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert
} from "react-native";
import {router} from "expo-router";
import {supabase} from "../../services/supabase";

export default function AddActivityClub(){
  const [name,setName]=useState("");
  const [category,setCategory]=useState("");
  const [description,setDescription]=useState("");
  const [location,setLocation]=useState("");
  const [address,setAddress]=useState("");
  const [price,setPrice]=useState("0");
  const [loading,setLoading]=useState(false);

  async function createClub(){
    if(loading) return;

    if(!name.trim() || !category.trim() || !location.trim()){
      Alert.alert("Missing information","Name, category and location are required.");
      return;
    }

    const numericPrice=Number(price || 0);
    if(Number.isNaN(numericPrice) || numericPrice<0){
      Alert.alert("Invalid price","Enter a valid price or 0 for a free club.");
      return;
    }

    setLoading(true);

    const {data:{user}}=await supabase.auth.getUser();
    if(!user){
      setLoading(false);
      router.replace("/auth/login");
      return;
    }

    const {data,error}=await supabase
      .from("activity_clubs")
      .insert({
        manager_id:user.id,
        name:name.trim(),
        category:category.trim(),
        description:description.trim(),
        location:location.trim(),
        address:address.trim(),
        price:numericPrice,
        status:"open"
      })
      .select("id")
      .single();

    setLoading(false);

    if(error){
      console.log(error);
      Alert.alert("Club not created",error.message);
      return;
    }

    Alert.alert("Activity Club created","Your listing is now available in the manager dashboard.");
    router.replace("/manager/dashboard");
  }

  return(
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Add Activity Club</Text>
      <Text style={styles.subtitle}>Create the public profile explorers will use to apply for membership.</Text>

      <TextInput style={styles.input} placeholder="Club name *" value={name} onChangeText={setName}/>
      <TextInput style={styles.input} placeholder="Category *" value={category} onChangeText={setCategory}/>
      <TextInput
        style={[styles.input,styles.multiline]}
        placeholder="Description"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      <TextInput style={styles.input} placeholder="Town or area *" value={location} onChangeText={setLocation}/>
      <TextInput style={styles.input} placeholder="Full address" value={address} onChangeText={setAddress}/>
      <TextInput
        style={styles.input}
        placeholder="Price per session"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
      />

      <Pressable style={styles.button} onPress={createClub} disabled={loading}>
        {loading ? <ActivityIndicator color="white"/> : <Text style={styles.buttonText}>Create Activity Club</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f5f7fb"},
  content:{padding:20,paddingBottom:50},
  title:{fontSize:30,fontWeight:"bold"},
  subtitle:{color:"#666",lineHeight:22,marginTop:7,marginBottom:20},
  input:{backgroundColor:"white",borderWidth:1,borderColor:"#ccc",borderRadius:11,padding:14,marginBottom:14},
  multiline:{minHeight:110,textAlignVertical:"top"},
  button:{backgroundColor:"#5633a8",padding:16,borderRadius:12,alignItems:"center"},
  buttonText:{color:"white",fontWeight:"bold"}
});

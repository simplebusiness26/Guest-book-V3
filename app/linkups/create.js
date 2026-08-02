import React,{useEffect,useState} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {router} from "expo-router";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";

export default function CreateLinkup(){
  const {showFeedback}=useFeedback();
  const [loading,setLoading]=useState(true);
  const [allowed,setAllowed]=useState(false);
  const [working,setWorking]=useState(false);
  const [title,setTitle]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{checkAccess();},[]);

  async function checkAccess(){
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/auth/login");return;}

    const {data,error:profileError}=await supabase
      .from("profiles")
      .select("account_type")
      .eq("id",user.id)
      .maybeSingle();

    if(profileError || data?.account_type!=="explorer"){
      setError("Only Explorer accounts can create Link-ups.");
    }else{
      setAllowed(true);
    }
    setLoading(false);
  }

  async function create(){
    if(working) return;

    const cleanTitle=title.trim();
    setError("");

    if(cleanTitle.length<3 || cleanTitle.length>100){
      setError("Add a title with between 3 and 100 characters.");
      return;
    }

    setWorking(true);
    const {data,error:createError}=await supabase.rpc("quick_create_linkup",{
      p_title:cleanTitle
    });

    if(createError){
      setWorking(false);
      setError(createError.message || "The Link-up could not be created.");
      return;
    }

    showFeedback(
      "Your Link-up is live. You can edit the time, place and other details now.",
      "success",
      "Link-up created"
    );
    router.replace(`/linkups/${data}`);
  }

  if(loading){
    return(
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#bca8ff"/>
      </View>
    );
  }

  return(
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.eyebrow}>MAKE A PLAN</Text>
      <Text style={styles.heading}>Create Link-up</Text>
      <Text style={styles.subtitle}>
        Give it a title now. You can add the time, meeting place and full details afterward.
      </Text>

      {!!error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {allowed && (
        <View style={styles.card}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            autoFocus
            value={title}
            onChangeText={setTitle}
            onSubmitEditing={create}
            returnKeyType="done"
            maxLength={100}
            placeholder="Five-a-side football"
            placeholderTextColor="#74747d"
            style={styles.input}
          />

          <View style={styles.defaultsCard}>
            <Text style={styles.defaultsTitle}>Added automatically</Text>
            <Text style={styles.defaultsText}>
              Tomorrow · two hours · eight spaces · public · meeting place to be confirmed
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            testID="quick-create-linkup-button"
            disabled={working}
            style={[styles.createButton,working&&styles.disabled]}
            onPress={create}
          >
            {working
              ? <ActivityIndicator color="white"/>
              : <Text style={styles.createText}>Create Link-up</Text>
            }
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:18,paddingBottom:70},
  center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center"},
  eyebrow:{color:"#a991f0",fontSize:10,fontWeight:"900",letterSpacing:1},
  heading:{color:"white",fontSize:36,fontWeight:"900",marginTop:5},
  subtitle:{color:"#a9a9b2",fontSize:16,lineHeight:23,marginTop:10},
  errorCard:{backgroundColor:"#431f26",borderColor:"#7e3541",borderWidth:1,borderRadius:12,padding:13,marginTop:18},
  errorText:{color:"#ffc1c9",lineHeight:19},
  card:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:18,padding:17,marginTop:24},
  label:{color:"white",fontSize:15,fontWeight:"900",marginBottom:9},
  input:{backgroundColor:"#18181c",borderColor:"#55555e",borderWidth:1,borderRadius:13,color:"white",fontSize:18,paddingHorizontal:15,paddingVertical:15},
  defaultsCard:{backgroundColor:"#29233d",borderColor:"#504371",borderWidth:1,borderRadius:12,padding:13,marginTop:14},
  defaultsTitle:{color:"#d9ceff",fontWeight:"900",fontSize:12},
  defaultsText:{color:"#aaa0c4",fontSize:12,lineHeight:18,marginTop:5},
  createButton:{backgroundColor:"#3212b6",borderRadius:14,paddingVertical:16,alignItems:"center",marginTop:18},
  createText:{color:"white",fontSize:16,fontWeight:"900"},
  disabled:{opacity:.6}
});

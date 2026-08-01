import React,{useCallback,useState} from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert
} from "react-native";
import {router,useFocusEffect,useLocalSearchParams} from "expo-router";
import {supabase} from "../../../services/supabase";

export default function ActivityClubMessageBoard(){
  const {id}=useLocalSearchParams();
  const [club,setClub]=useState(null);
  const [messages,setMessages]=useState([]);
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [allowed,setAllowed]=useState(false);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(true);
  const [sending,setSending]=useState(false);
  const [error,setError]=useState("");

  useFocusEffect(
    useCallback(()=>{
      if(id) loadBoard();
    },[id])
  );

  async function loadBoard(){
    setLoading(true);
    setError("");

    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){
      router.replace("/auth/login");
      return;
    }

    setUser(currentUser);

    const [{data:profileRow},{data:clubRow,error:clubError}]=await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id",currentUser.id)
        .single(),
      supabase
        .from("activity_clubs")
        .select("id,name,manager_id")
        .eq("id",id)
        .single()
    ]);

    if(clubError || !clubRow){
      setError("This message board could not be loaded.");
      setLoading(false);
      return;
    }

    setProfile(profileRow || null);
    setClub(clubRow);

    let hasAccess=clubRow.manager_id===currentUser.id;

    if(!hasAccess){
      const {data:membership}=await supabase
        .from("activity_memberships")
        .select("status")
        .eq("club_id",id)
        .eq("user_id",currentUser.id)
        .maybeSingle();

      hasAccess=membership?.status==="approved";
    }

    setAllowed(hasAccess);

    if(!hasAccess){
      setError("This message board is private. The club manager must approve your membership first.");
      setLoading(false);
      return;
    }

    const {data:messageRows,error:messageError}=await supabase
      .from("activity_messages")
      .select("*")
      .eq("club_id",id)
      .order("created_at",{ascending:true});

    if(messageError){
      console.log(messageError);
      setError("Messages could not be loaded.");
      setLoading(false);
      return;
    }

    setMessages(messageRows || []);
    setLoading(false);
  }

  async function postMessage(){
    const clean=message.trim();
    if(!clean || !user || !allowed || sending) return;

    setSending(true);

    const {error:postError}=await supabase
      .from("activity_messages")
      .insert({
        club_id:id,
        user_id:user.id,
        author_name:profile?.full_name || "Member",
        message:clean
      });

    setSending(false);

    if(postError){
      console.log(postError);
      Alert.alert("Message not sent",postError.message);
      return;
    }

    setMessage("");
    await loadBoard();
  }

  if(loading){
    return(
      <View style={styles.center}>
        <ActivityIndicator size="large"/>
      </View>
    );
  }

  if(error || !allowed){
    return(
      <View style={styles.center}>
        <Text style={styles.lock}>🔒</Text>
        <Text style={styles.errorTitle}>Members only</Text>
        <Text style={styles.errorText}>{error}</Text>
        {!!club && (
          <Pressable style={styles.backButton} onPress={()=>router.replace(`/activity-clubs/${club.id}`)}>
            <Text style={styles.buttonText}>Return to Public Profile</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return(
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{club?.name}</Text>
        <Text style={styles.subtitle}>Private members’ message board</Text>
      </View>

      <ScrollView style={styles.messageList} contentContainerStyle={styles.messageContent}>
        {messages.length===0 && (
          <View style={styles.emptyBox}>
            <Text>No messages yet. Start the conversation.</Text>
          </View>
        )}

        {messages.map(item=>(
          <View key={item.id} style={styles.messageCard}>
            <Text style={styles.author}>{item.author_name || "Member"}</Text>
            <Text style={styles.body}>{item.message}</Text>
            <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Write a message"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={1000}
        />
        <Pressable style={styles.sendButton} onPress={postMessage} disabled={sending}>
          <Text style={styles.buttonText}>{sending ? "Sending..." : "Send"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles=StyleSheet.create({
  container:{flex:1,backgroundColor:"#f5f6f8"},
  center:{flex:1,alignItems:"center",justifyContent:"center",padding:30},
  header:{padding:20,backgroundColor:"white",borderBottomWidth:1,borderColor:"#ddd"},
  title:{fontSize:24,fontWeight:"bold"},
  subtitle:{color:"#666",marginTop:5},
  messageList:{flex:1},
  messageContent:{padding:16,paddingBottom:30},
  emptyBox:{backgroundColor:"white",padding:16,borderRadius:12,borderWidth:1,borderColor:"#ddd"},
  messageCard:{backgroundColor:"white",padding:15,borderRadius:12,borderWidth:1,borderColor:"#ddd",marginBottom:10},
  author:{fontWeight:"bold",fontSize:16},
  body:{fontSize:16,lineHeight:22,marginTop:6},
  time:{fontSize:11,color:"#777",marginTop:8},
  composer:{padding:12,backgroundColor:"white",borderTopWidth:1,borderColor:"#ddd"},
  input:{borderWidth:1,borderColor:"#ccc",borderRadius:12,padding:12,minHeight:54,maxHeight:120},
  sendButton:{backgroundColor:"#5633a8",padding:14,borderRadius:10,marginTop:8},
  buttonText:{color:"white",fontWeight:"bold",textAlign:"center"},
  lock:{fontSize:42},
  errorTitle:{fontSize:24,fontWeight:"bold",marginTop:12},
  errorText:{textAlign:"center",color:"#555",lineHeight:22,marginTop:8},
  backButton:{backgroundColor:"#222",padding:14,borderRadius:10,marginTop:18,width:"100%"}
});

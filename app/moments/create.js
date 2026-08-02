import React,{useEffect,useMemo,useState} from "react";
import {ActivityIndicator,Image,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {router} from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {supabase} from "../../services/supabase";
import {useFeedback} from "../../context/FeedbackContext";
import {resolveVideoDuration,uploadSocialAsset} from "../../utils/socialMedia";

const PLACE_TYPES={
  business:{label:"Business",table:"businesses",select:"id,name,image,photos",image:row=>row.image || row.photos?.[0] || null},
  property:{label:"Stay",table:"properties",select:"id,name,photos",image:row=>row.photos?.[0] || null},
  activity_club:{label:"Club",table:"activity_clubs",select:"id,name,image_url,status",image:row=>row.image_url || null,status:"published"},
  event:{label:"Event",table:"events",select:"id,name,image_url,status",image:row=>row.image_url || null,status:"published"}
};

export default function CreateMoment(){
  const {showFeedback}=useFeedback();
  const [user,setUser]=useState(null);
  const [asset,setAsset]=useState(null);
  const [mediaType,setMediaType]=useState(null);
  const [caption,setCaption]=useState("");
  const [placeType,setPlaceType]=useState(null);
  const [places,setPlaces]=useState([]);
  const [placeQuery,setPlaceQuery]=useState("");
  const [selectedPlace,setSelectedPlace]=useState(null);
  const [loading,setLoading]=useState(true);
  const [loadingPlaces,setLoadingPlaces]=useState(false);
  const [publishing,setPublishing]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{loadUser();},[]);

  async function loadUser(){
    const {data:{user:currentUser}}=await supabase.auth.getUser();
    if(!currentUser){
      router.replace("/auth/login");
      return;
    }

    const {data:profile,error:profileError}=await supabase
      .from("profiles")
      .select("account_type")
      .eq("id",currentUser.id)
      .single();

    if(profileError || profile?.account_type!=="explorer"){
      setError("Only Explorer accounts can publish Moments.");
      setLoading(false);
      return;
    }

    setUser(currentUser);
    setLoading(false);
  }

  async function requestPermission(){
    if(Platform.OS==="web") return true;
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(permission.granted) return true;
    setError("Allow access to your media library before selecting a photo or video.");
    return false;
  }

  async function pickImage(){
    setError("");
    try{
      if(!(await requestPermission())) return;
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:ImagePicker.MediaTypeOptions.Images,
        allowsEditing:false,
        allowsMultipleSelection:false,
        quality:0.8
      });
      if(!result.canceled && result.assets?.[0]){
        setAsset(result.assets[0]);
        setMediaType("image");
      }
    }catch(pickerError){
      console.error(pickerError);
      setError("The photo picker could not return to Guestbook. Open the preview in a separate browser tab and try again.");
    }
  }

  async function pickVideo(){
    setError("");
    try{
      if(!(await requestPermission())) return;
      const result=await ImagePicker.launchImageLibraryAsync({
        mediaTypes:ImagePicker.MediaTypeOptions.Videos,
        allowsEditing:false,
        allowsMultipleSelection:false,
        videoMaxDuration:30,
        quality:0.7
      });
      if(result.canceled || !result.assets?.[0]) return;

      const chosen=result.assets[0];
      if(chosen.fileSize && chosen.fileSize>52_428_800){
        setError("This video is larger than 50 MB. Choose a shorter or lower-quality clip.");
        return;
      }

      const seconds=await resolveVideoDuration(chosen);
      if(!seconds){
        setError("Guestbook could not read this video's duration. Choose a different clip.");
        return;
      }
      if(seconds>30.25){
        setError("Moments videos must be 30 seconds or shorter.");
        return;
      }

      setAsset({...chosen,resolvedDuration:seconds});
      setMediaType("video");
    }catch(pickerError){
      console.error(pickerError);
      setError("The video picker could not return to Guestbook. Open the preview in a separate browser tab and try again.");
    }
  }

  async function choosePlaceType(type){
    setPlaceType(type);
    setSelectedPlace(null);
    setPlaceQuery("");

    if(!type){
      setPlaces([]);
      return;
    }

    setLoadingPlaces(true);
    const config=PLACE_TYPES[type];
    let request=supabase.from(config.table).select(config.select).order("name",{ascending:true}).limit(50);
    if(config.status) request=request.eq("status",config.status);
    const {data,error:placeError}=await request;

    if(placeError){
      console.log(placeError);
      setError("Places could not be loaded.");
      setPlaces([]);
    }else{
      setPlaces((data || []).map(row=>({...row,displayImage:config.image(row)})));
    }
    setLoadingPlaces(false);
  }

  const filteredPlaces=useMemo(()=>{
    const term=placeQuery.trim().toLowerCase();
    if(!term) return places;
    return places.filter(item=>item.name?.toLowerCase().includes(term));
  },[places,placeQuery]);

  async function publish(){
    if(publishing || !user) return;
    setError("");

    if(!asset || !mediaType){
      setError("Choose a photo or video for your Moment.");
      return;
    }

    if(caption.length>500){
      setError("Moment captions can contain up to 500 characters.");
      return;
    }

    setPublishing(true);
    let uploadedPath=null;

    try{
      const upload=await uploadSocialAsset({asset,userId:user.id,mediaType});
      uploadedPath=upload.path;

      const {error:uploadError}=await supabase.storage
        .from("social-media")
        .upload(upload.path,upload.bytes,{contentType:upload.contentType,upsert:false});
      if(uploadError) throw new Error(uploadError.message);

      const {data:urlData}=supabase.storage.from("social-media").getPublicUrl(upload.path);
      if(!urlData?.publicUrl) throw new Error("The uploaded media URL could not be created.");

      const duration=mediaType==="video"
        ? Number(asset.resolvedDuration || await resolveVideoDuration(asset))
        : null;

      if(mediaType==="video" && (!duration || duration>30.25)){
        throw new Error("The selected video must be 30 seconds or shorter.");
      }

      const {data:moment,error:insertError}=await supabase
        .from("explorer_moments")
        .insert({
          user_id:user.id,
          caption:caption.trim(),
          media_type:mediaType,
          media_url:urlData.publicUrl,
          thumbnail_url:mediaType==="video" ? selectedPlace?.displayImage || null : null,
          duration_seconds:duration,
          target_type:selectedPlace ? placeType : null,
          target_id:selectedPlace?.id || null,
          target_name:selectedPlace?.name || null,
          target_image_url:selectedPlace?.displayImage || null,
          status:"published"
        })
        .select("id")
        .single();

      if(insertError) throw new Error(insertError.message);

      showFeedback("Your followers can now see this Moment.","success","Moment published");
      router.replace(`/moments/${moment.id}`);
    }catch(publishError){
      console.error(publishError);
      if(uploadedPath) await supabase.storage.from("social-media").remove([uploadedPath]);
      setError(publishError.message || "The Moment could not be published.");
      setPublishing(false);
    }
  }

  if(loading){
    return <View style={styles.center}><ActivityIndicator size="large" color="#bca8ff"/></View>;
  }

  return(
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.eyebrow}>SHARE YOUR DAY</Text>
      <Text style={styles.title}>New Moment</Text>
      <Text style={styles.subtitle}>Post a photo or short video for the Explorers who follow you.</Text>

      {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}

      <View style={styles.mediaCard}>
        {asset && mediaType==="image" ? (
          <Image source={{uri:asset.uri}} style={styles.preview}/>
        ) : asset && mediaType==="video" ? (
          <View style={styles.videoPreview}>
            <Text style={styles.videoIcon}>▶</Text>
            <Text style={styles.videoTitle}>Video selected</Text>
            <Text style={styles.videoMeta}>{Math.ceil(Number(asset.resolvedDuration || 0))} seconds</Text>
          </View>
        ) : (
          <View style={styles.mediaEmpty}>
            <Text style={styles.mediaEmptyIcon}>✨</Text>
            <Text style={styles.mediaEmptyTitle}>Choose your Moment</Text>
            <Text style={styles.mediaEmptyText}>One photo or one video up to 30 seconds.</Text>
          </View>
        )}

        <View style={styles.mediaButtons}>
          <Pressable style={styles.mediaButton} onPress={pickImage}><Text style={styles.mediaButtonText}>Choose photo</Text></Pressable>
          <Pressable style={styles.mediaButton} onPress={pickVideo}><Text style={styles.mediaButtonText}>Choose video</Text></Pressable>
        </View>
      </View>

      <Text style={styles.label}>Caption</Text>
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder="What made this worth sharing?"
        placeholderTextColor="#74747d"
        style={styles.captionInput}
        multiline
        maxLength={500}
        textAlignVertical="top"
      />
      <Text style={styles.counter}>{caption.length}/500</Text>

      <Text style={styles.label}>Attach a place <Text style={styles.optional}>(optional)</Text></Text>
      <View style={styles.typeRow}>
        <Pressable style={[styles.typeButton,!placeType && styles.typeButtonActive]} onPress={()=>choosePlaceType(null)}><Text style={[styles.typeText,!placeType && styles.typeTextActive]}>None</Text></Pressable>
        {Object.entries(PLACE_TYPES).map(([key,config])=>(
          <Pressable key={key} style={[styles.typeButton,placeType===key && styles.typeButtonActive]} onPress={()=>choosePlaceType(key)}>
            <Text style={[styles.typeText,placeType===key && styles.typeTextActive]}>{config.label}</Text>
          </Pressable>
        ))}
      </View>

      {!!placeType && (
        <View style={styles.placesCard}>
          <TextInput value={placeQuery} onChangeText={setPlaceQuery} placeholder="Search places" placeholderTextColor="#74747d" style={styles.placeSearch}/>
          {loadingPlaces && <ActivityIndicator color="#bca8ff" style={{marginVertical:18}}/>}
          {!loadingPlaces && filteredPlaces.slice(0,20).map(place=>(
            <Pressable key={place.id} style={[styles.placeRow,selectedPlace?.id===place.id && styles.placeRowSelected]} onPress={()=>setSelectedPlace(place)}>
              {place.displayImage ? <Image source={{uri:place.displayImage}} style={styles.placeImage}/> : <View style={styles.placeFallback}><Text>📍</Text></View>}
              <Text style={styles.placeName} numberOfLines={2}>{place.name}</Text>
              <Text style={styles.placeCheck}>{selectedPlace?.id===place.id ? "✓" : ""}</Text>
            </Pressable>
          ))}
          {!loadingPlaces && filteredPlaces.length===0 && <Text style={styles.noPlaces}>No matching places found.</Text>}
        </View>
      )}

      <Pressable style={[styles.publishButton,publishing && styles.disabled]} disabled={publishing} onPress={publish}>
        {publishing ? <ActivityIndicator color="white"/> : <Text style={styles.publishText}>Publish Moment</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:"#18181b"},
  content:{padding:18,paddingBottom:70},
  center:{flex:1,backgroundColor:"#18181b",alignItems:"center",justifyContent:"center"},
  eyebrow:{color:"#a991f0",fontSize:10,fontWeight:"900",letterSpacing:1},
  title:{color:"white",fontSize:31,fontWeight:"900",marginTop:4},
  subtitle:{color:"#a9a9b2",fontSize:14,lineHeight:21,marginTop:7,marginBottom:17},
  errorCard:{backgroundColor:"#441f25",borderColor:"#7f3541",borderWidth:1,borderRadius:13,padding:13,marginBottom:14},
  errorText:{color:"#ffbdc7",lineHeight:19},
  mediaCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:17,padding:12},
  preview:{width:"100%",height:300,borderRadius:13,backgroundColor:"#303036"},
  videoPreview:{height:230,borderRadius:13,backgroundColor:"#101013",alignItems:"center",justifyContent:"center"},
  videoIcon:{color:"white",fontSize:40},
  videoTitle:{color:"white",fontSize:18,fontWeight:"900",marginTop:9},
  videoMeta:{color:"#a0a0aa",marginTop:4},
  mediaEmpty:{height:220,borderRadius:13,backgroundColor:"#29292e",alignItems:"center",justifyContent:"center",padding:22},
  mediaEmptyIcon:{fontSize:36},
  mediaEmptyTitle:{color:"white",fontSize:19,fontWeight:"900",marginTop:9},
  mediaEmptyText:{color:"#9d9da6",textAlign:"center",marginTop:6},
  mediaButtons:{flexDirection:"row",gap:10,marginTop:11},
  mediaButton:{flex:1,backgroundColor:"#302655",borderColor:"#5d4b91",borderWidth:1,borderRadius:11,paddingVertical:12,alignItems:"center"},
  mediaButtonText:{color:"#e2d9ff",fontWeight:"900"},
  label:{color:"white",fontSize:15,fontWeight:"900",marginTop:20,marginBottom:8},
  optional:{color:"#85858e",fontWeight:"700"},
  captionInput:{minHeight:120,backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:14,color:"white",fontSize:15,lineHeight:22,padding:14},
  counter:{color:"#777780",fontSize:11,textAlign:"right",marginTop:5},
  typeRow:{flexDirection:"row",flexWrap:"wrap",gap:7},
  typeButton:{backgroundColor:"#252529",borderColor:"#414147",borderWidth:1,borderRadius:20,paddingHorizontal:12,paddingVertical:8},
  typeButtonActive:{backgroundColor:"#3212b6",borderColor:"#6245e8"},
  typeText:{color:"#a3a3ac",fontSize:12,fontWeight:"900"},
  typeTextActive:{color:"white"},
  placesCard:{backgroundColor:"#222226",borderColor:"#414147",borderWidth:1,borderRadius:14,padding:11,marginTop:11},
  placeSearch:{backgroundColor:"#2b2b30",borderColor:"#47474f",borderWidth:1,borderRadius:11,color:"white",paddingHorizontal:12,paddingVertical:11,marginBottom:8},
  placeRow:{flexDirection:"row",alignItems:"center",borderRadius:11,padding:8,marginTop:5},
  placeRowSelected:{backgroundColor:"#302655",borderColor:"#5d4b91",borderWidth:1},
  placeImage:{width:46,height:46,borderRadius:9,backgroundColor:"#303036"},
  placeFallback:{width:46,height:46,borderRadius:9,backgroundColor:"#303036",alignItems:"center",justifyContent:"center"},
  placeName:{color:"white",fontWeight:"800",flex:1,marginLeft:10},
  placeCheck:{color:"#c8b6ff",fontSize:18,fontWeight:"900",width:24,textAlign:"center"},
  noPlaces:{color:"#92929b",textAlign:"center",paddingVertical:18},
  publishButton:{backgroundColor:"#3212b6",borderRadius:14,paddingVertical:16,alignItems:"center",marginTop:22},
  publishText:{color:"white",fontSize:16,fontWeight:"900"},
  disabled:{opacity:0.65}
});

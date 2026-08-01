import React, { useState } from "react";

import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
  Alert,
} from "react-native";

import {
  useLocalSearchParams,
  router,
} from "expo-router";

import * as ImagePicker from "expo-image-picker";

import { supabase } from "../../../services/supabase";


export default function PropertyReview() {
  const params = useLocalSearchParams();

  const propertyId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const [name, setName] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(5);

  const [selectedImages, setSelectedImages] = useState([]);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");


  async function pickImages() {
    setErrorMessage("");

    if (selectedImages.length >= 3) {
      setErrorMessage(
        "You can add a maximum of 3 photos."
      );
      return;
    }

    try {
      if (Platform.OS !== "web") {
        const permissionResult =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissionResult.granted) {
          setErrorMessage(
            "Please allow access to your photos before choosing an image."
          );
          return;
        }
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes:
            ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          allowsMultipleSelection: false,
          quality: 0.7,
        });

      if (
        result.canceled ||
        !result.assets?.length
      ) {
        return;
      }

      const selectedImage =
        result.assets[0];

      setSelectedImages((currentImages) => [
        ...currentImages,
        selectedImage,
      ].slice(0, 3));
    } catch (error) {
      console.error(
        "Property image picker error:",
        error
      );

      setErrorMessage(
        "The photo picker could not return to the app. Try opening the preview in a separate browser tab."
      );
    }
  }


  function removeImage(imageIndex) {
    if (loading) {
      return;
    }

    setSelectedImages((currentImages) =>
      currentImages.filter(
        (_, index) => index !== imageIndex
      )
    );
  }


  function getFileExtension(asset) {
    if (
      asset.fileName &&
      asset.fileName.includes(".")
    ) {
      return asset.fileName
        .split(".")
        .pop()
        .toLowerCase();
    }

    if (
      asset.mimeType &&
      asset.mimeType.includes("/")
    ) {
      const mimeExtension =
        asset.mimeType
          .split("/")
          .pop()
          .toLowerCase();

      if (mimeExtension === "jpeg") {
        return "jpg";
      }

      return mimeExtension;
    }

    return "jpg";
  }


  async function uploadReviewImages(userId) {
    const uploadedPhotoUrls = [];

    for (
      let index = 0;
      index < selectedImages.length;
      index++
    ) {
      const asset =
        selectedImages[index];

      const extension =
        getFileExtension(asset);

      const randomPart =
        Math.random()
          .toString(36)
          .substring(2, 10);

      const fileName =
        `${Date.now()}-${index}-${randomPart}.${extension}`;

      const filePath =
        `${userId}/property-reviews/${propertyId}/${fileName}`;

      const response =
        await fetch(asset.uri);

      if (!response.ok) {
        throw new Error(
          "One of the selected photos could not be read."
        );
      }

      const fileData =
        await response.arrayBuffer();

      const {
        error: uploadError,
      } = await supabase.storage
        .from("review-image")
        .upload(filePath, fileData, {
          contentType:
            asset.mimeType ||
            `image/${extension}`,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(
          uploadError.message
        );
      }

      const {
        data: publicUrlData,
      } = supabase.storage
        .from("review-image")
        .getPublicUrl(filePath);

      if (!publicUrlData?.publicUrl) {
        throw new Error(
          "The uploaded photo URL could not be created."
        );
      }

      uploadedPhotoUrls.push(
        publicUrlData.publicUrl
      );
    }

    return uploadedPhotoUrls;
  }


  async function submitReview() {
    setErrorMessage("");

    const cleanName = name.trim();
    const cleanComment =
      comment.trim();

    if (!cleanName) {
      setErrorMessage(
        "Please enter your name."
      );
      return;
    }

    if (!cleanComment) {
      setErrorMessage(
        "Please write your review."
      );
      return;
    }

    if (!propertyId) {
      setErrorMessage(
        "The property could not be identified."
      );
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(
          "You must be logged in before leaving a review."
        );
      }

      let photoUrls = [];

      if (selectedImages.length > 0) {
        photoUrls =
          await uploadReviewImages(
            user.id
          );
      }

      const {
        error: insertError,
      } = await supabase
        .from("reviews")
        .insert({
          name: cleanName,
          business_id: null,
          property_id: propertyId,
          user_id: user.id,
          rating,
          comment: cleanComment,
          photos: photoUrls,
        });

      if (insertError) {
        throw new Error(
          insertError.message
        );
      }

      Alert.alert(
        "Success",
        "Review submitted"
      );

      router.back();
    } catch (error) {
      console.error(
        "Property review submission error:",
        error
      );

      setErrorMessage(
        error?.message ||
        "Something went wrong while submitting your review."
      );
    } finally {
      setLoading(false);
    }
  }


  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>
        Leave a Property Review
      </Text>

      <Text style={styles.subtitle}>
        Share your experience of this stay
      </Text>


      {errorMessage ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {errorMessage}
          </Text>
        </View>
      ) : null}


      <TextInput
        style={styles.input}
        placeholder="Your name"
        value={name}
        onChangeText={setName}
        editable={!loading}
      />


      <Text style={styles.label}>
        Rating
      </Text>


      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map(
          (star) => (
            <Pressable
              key={star}
              onPress={() =>
                setRating(star)
              }
              disabled={loading}
            >
              <Text style={styles.star}>
                {star <= rating
                  ? "⭐"
                  : "☆"}
              </Text>
            </Pressable>
          )
        )}
      </View>


      <Text style={styles.ratingText}>
        Rating: {rating}/5
      </Text>


      <TextInput
        style={styles.textarea}
        placeholder="Write your review"
        value={comment}
        onChangeText={setComment}
        multiline
        editable={!loading}
      />


      <View
        style={styles.photoHeadingRow}
      >
        <View>
          <Text
            style={styles.photoTitle}
          >
            Add photos
          </Text>

          <Text
            style={
              styles.photoSubtitle
            }
          >
            Optional — add up to 3 photos
          </Text>
        </View>

        <Text style={styles.photoCount}>
          {selectedImages.length}/3
        </Text>
      </View>


      {selectedImages.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.imagePreviewRow
          }
        >
          {selectedImages.map(
            (image, index) => (
              <View
                key={`${image.uri}-${index}`}
                style={
                  styles.imagePreviewContainer
                }
              >
                <Image
                  source={{
                    uri: image.uri,
                  }}
                  style={
                    styles.imagePreview
                  }
                />

                <Pressable
                  style={
                    styles.removeImageButton
                  }
                  onPress={() =>
                    removeImage(index)
                  }
                  disabled={loading}
                >
                  <Text
                    style={
                      styles.removeImageText
                    }
                  >
                    ×
                  </Text>
                </Pressable>
              </View>
            )
          )}
        </ScrollView>
      ) : null}


      {selectedImages.length < 3 ? (
        <Pressable
          style={[
            styles.photoButton,
            loading &&
              styles.disabledButton,
          ]}
          onPress={pickImages}
          disabled={loading}
        >
          <Text
            style={
              styles.photoButtonText
            }
          >
            📷 Choose One Photo
          </Text>
        </Pressable>
      ) : null}


      <Pressable
        style={[
          styles.button,
          loading &&
            styles.disabledButton,
        ]}
        onPress={submitReview}
        disabled={loading}
      >
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator
              color="white"
            />

            <Text
              style={styles.loadingText}
            >
              Uploading review...
            </Text>
          </View>
        ) : (
          <Text
            style={styles.buttonText}
          >
            Submit Review
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },

  content: {
    padding: 25,
    paddingBottom: 60,
  },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    color: "#555",
    marginBottom: 25,
  },

  errorBox: {
    backgroundColor: "#ffe8e8",
    borderWidth: 1,
    borderColor: "#e5a7a7",
    padding: 14,
    borderRadius: 12,
    marginBottom: 18,
  },

  errorText: {
    color: "#a40000",
    fontWeight: "600",
  },

  input: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },

  label: {
    fontSize: 18,
    fontWeight: "bold",
  },

  stars: {
    flexDirection: "row",
    marginVertical: 15,
  },

  star: {
    fontSize: 35,
  },

  ratingText: {
    marginBottom: 20,
    fontWeight: "600",
  },

  textarea: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 15,
    height: 120,
    textAlignVertical: "top",
  },

  photoHeadingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 25,
    marginBottom: 12,
  },

  photoTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },

  photoSubtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 3,
  },

  photoCount: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#0066ff",
  },

  imagePreviewRow: {
    paddingBottom: 12,
  },

  imagePreviewContainer: {
    width: 120,
    height: 120,
    marginRight: 12,
    position: "relative",
  },

  imagePreview: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
    backgroundColor: "#ddd",
  },

  removeImageButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor:
      "rgba(0, 0, 0, 0.75)",
    alignItems: "center",
    justifyContent: "center",
  },

  removeImageText: {
    color: "white",
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "bold",
  },

  photoButton: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#0066ff",
    borderRadius: 12,
    padding: 15,
    alignItems: "center",
  },

  photoButtonText: {
    color: "#0066ff",
    fontWeight: "bold",
    fontSize: 16,
  },

  button: {
    marginTop: 20,
    backgroundColor: "#222",
    padding: 16,
    borderRadius: 10,
    alignItems: "center",
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 10,
  },
});
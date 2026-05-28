<template>
  <!-- This view shows the chat image preview modal. -->
  <dialog ref="dialogRef" id="global_image_preview_modal" class="modal global-image-preview-modal" @click="onDialogClick">
    <div class="modal-box">
      <!-- Provide a simple close control for the fullscreen image preview. -->
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 close-forum" type="button" @click="close">✕</button>

      <!-- Scale the selected image to fit within the viewport. -->
      <img class="img-container" :src="imgSrc" />
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "vuex";

const store = useStore();
const dialogRef = ref<HTMLDialogElement | null>(null);
const imgSrc = computed(() => store.state.modalImgSrc);

function close() {
  dialogRef.value?.close();
}

function onDialogClick(event: MouseEvent) {
  if (event.target === dialogRef.value) close();
}
</script>

<style lang="scss" scoped>
.global-image-preview-modal {
  .modal-box {
    max-width: 100vw;
    max-height: 100vh;
    height: 100vh;
    width: 100vw;
    background-color: oklch(0% 0 0 / 0.32);
    box-shadow: initial;
    overflow: hidden;
  }

  .close-forum {
    z-index: 2;
    background-color: transparent;
    color: oklch(var(--nc));
    font-size: 36px;
  }

  .img-container {
    height: 100%;
    width: 100%;
    object-fit: contain;
  }
}
</style>

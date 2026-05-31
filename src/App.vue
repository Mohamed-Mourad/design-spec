<script setup lang="ts">
import { RouterView } from 'vue-router'
import ReportErrorModal from '@/components/shared/ReportErrorModal.vue'
import ReportLauncher from '@/components/shared/ReportLauncher.vue'
</script>

<template>
  <RouterView />
  <ReportLauncher />
  <ReportErrorModal />
</template>

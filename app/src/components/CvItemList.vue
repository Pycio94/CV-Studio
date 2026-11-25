<script setup lang="ts">
import { computed } from 'vue'
import { formatItem, nonEmptyItems } from '../listUtils'
import type { Item } from '../model'

const props = withDefaults(defineProps<{
  heading: string
  items: readonly Item[]
  variant?: 'inline' | 'stacked'
  sectionClass?: string
}>(), {
  variant: 'inline',
  sectionClass: '',
})

const entries = computed(() => nonEmptyItems(props.items))
</script>

<template>
  <section v-if="entries.length" class="cv-section" :class="sectionClass">
    <h2 v-if="heading.trim()">{{ heading }}</h2>
    <ul class="plain-list">
      <li v-for="entry in entries" :key="entry.id">
        <template v-if="variant === 'stacked'">
          <strong v-if="entry.label.trim()">{{ entry.label }}</strong>
          <span v-if="entry.detail.trim()" class="item-detail">{{ entry.detail }}</span>
        </template>
        <template v-else>{{ formatItem(entry) }}</template>
      </li>
    </ul>
  </section>
</template>

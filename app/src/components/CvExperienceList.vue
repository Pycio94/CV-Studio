<script setup lang="ts">
import { computed } from 'vue'
import { formatItem, hasExperienceContent, nonEmptyItems } from '../listUtils'
import type { CvDocument, Experience } from '../model'

const props = defineProps<{
  heading: string
  entries: readonly Experience[]
  layout: CvDocument['layout']
}>()

const visibleEntries = computed(() => props.entries.filter(hasExperienceContent))
</script>

<template>
  <section v-if="visibleEntries.length" class="cv-section cv-experience">
    <h2 v-if="heading.trim()">{{ heading }}</h2>
    <div v-for="entry in visibleEntries" :key="entry.id" class="experience-entry">
      <template v-if="layout === 'timeline'">
        <div v-if="entry.title.trim() || entry.dates.trim()" class="timeline-role-heading">
          <h3 v-if="entry.title.trim()">{{ entry.title }}</h3>
          <span v-if="entry.dates.trim()">{{ entry.dates }}</span>
        </div>
        <p v-if="entry.company.trim()" class="experience-meta timeline-company">{{ entry.company }}</p>
      </template>
      <template v-else>
        <h3 v-if="entry.title.trim()">{{ entry.title }}</h3>
        <p v-if="entry.company.trim() || entry.dates.trim()" class="experience-meta">
          {{ [entry.company.trim(), entry.dates.trim()].filter(Boolean).join(' | ') }}
        </p>
      </template>
      <p v-if="entry.description.trim()" class="preserve-lines">{{ entry.description }}</p>
      <ul v-if="nonEmptyItems(entry.bullets).length">
        <li v-for="bullet in nonEmptyItems(entry.bullets)" :key="bullet.id">
          {{ formatItem(bullet) }}
        </li>
      </ul>
    </div>
  </section>
</template>

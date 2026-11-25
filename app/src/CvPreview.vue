<script setup lang="ts">
import { computed } from 'vue'
import CvExperienceList from './components/CvExperienceList.vue'
import CvItemList from './components/CvItemList.vue'
import { getLayout } from './layouts'
import { safeUrl, type CvDocument } from './model'

const props = defineProps<{ doc: CvDocument }>()

const layoutConfig = computed(() => getLayout(props.doc.layout))
const visibleContacts = computed(() => props.doc.contacts.filter(entry => entry.value.trim()))

function isExternalUrl(url: string | undefined): boolean {
  return Boolean(url && /^https?:/i.test(url))
}
</script>

<template>
  <!-- Root CV page. The layout modifier controls Classic, ATS, or Timeline structure. -->
  <article class="cv" :class="`cv--${doc.layout}`" :style="{ '--experience-size': `${doc.experienceFontSize}pt` }" aria-label="CV preview">
    <!-- Candidate identity area: photo, full name, and professional title. -->
    <header class="cv-header">
      <img v-if="doc.photo" :src="doc.photo" :alt="doc.name.trim() ? `Portrait of ${doc.name.trim()}` : 'Portrait'" class="cv-photo">
      <div>
        <h1>
          <template v-if="doc.name.trim()">{{ doc.name }}</template>
          <span v-else class="cv-placeholder">Your name</span>
        </h1>
        <p v-if="doc.title.trim()" class="cv-role">{{ doc.title }}</p>
      </div>
    </header>

    <!-- Main CV columns. Timeline uses the sidebar as a rail; ATS collapses both columns. -->
    <div class="cv-content">
      <!-- Left column: sections ordered by the active layout definition. -->
      <aside class="cv-sidebar">
        <template v-for="section in layoutConfig.sidebarSections" :key="section">
          <section v-if="section === 'contacts' && visibleContacts.length" class="cv-section">
            <h2 v-if="layoutConfig.showContactHeading && doc.headings.contact.trim()">{{ doc.headings.contact }}</h2>
            <ul class="plain-list">
              <li v-for="contact in visibleContacts" :key="contact.id">
                <span v-if="contact.label.trim()" class="contact-label">{{ contact.label }}: </span>
                <a
                  v-if="safeUrl(contact.url)"
                  :href="safeUrl(contact.url)"
                  :target="isExternalUrl(safeUrl(contact.url)) ? '_blank' : undefined"
                  :rel="isExternalUrl(safeUrl(contact.url)) ? 'noopener noreferrer' : undefined"
                >{{ contact.value }}</a>
                <span v-else>{{ contact.value }}</span>
              </li>
            </ul>
          </section>
          <CvItemList
            v-else-if="section === 'education'"
            :heading="doc.headings.education"
            :items="doc.education"
            variant="stacked"
          />
          <CvItemList
            v-else-if="section === 'languages'"
            :heading="doc.headings.languages"
            :items="doc.languages"
          />
          <CvItemList
            v-else-if="section === 'skills'"
            :heading="doc.headings.skills"
            :items="doc.skills"
          />
        </template>
      </aside>

      <!-- Main column: sections ordered by the active layout definition. -->
      <main class="cv-main">
        <template v-for="section in layoutConfig.mainSections" :key="section">
          <section v-if="section === 'summary' && doc.summary.trim()" class="cv-section">
            <h2 v-if="layoutConfig.showSummaryHeading && doc.headings.summary.trim()">{{ doc.headings.summary }}</h2>
            <p class="preserve-lines">{{ doc.summary }}</p>
          </section>
          <CvExperienceList
            v-else-if="section === 'experience'"
            :heading="doc.headings.experience"
            :entries="doc.experience"
            :layout="doc.layout"
          />
          <CvItemList
            v-else-if="section === 'education'"
            :heading="doc.headings.education"
            :items="doc.education"
            variant="stacked"
            section-class="cv-education"
          />
        </template>
      </main>
    </div>

    <!-- Optional consent statement, anchored to the bottom of paginated layouts. -->
    <footer v-if="doc.showConsent && doc.consent.trim()" class="cv-consent preserve-lines">{{ doc.consent }}</footer>
  </article>
</template>

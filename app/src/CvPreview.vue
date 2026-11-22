<script setup lang="ts">
import { safeUrl, type CvDocument, type Item } from './model'

defineProps<{ doc: CvDocument }>()

function hasItems(items: Item[]) {
  return items.some(item => item.label.trim() || item.detail.trim())
}
</script>

<template>
  <!-- Root CV page. The layout modifier controls Classic, ATS, or Timeline structure. -->
  <article class="cv" :class="`cv--${doc.layout}`" :style="{ '--experience-size': `${doc.experienceFontSize}pt` }" aria-label="CV preview">
    <!-- Candidate identity area: photo, full name, and professional title. -->
    <header class="cv-header">
      <img v-if="doc.photo" :src="doc.photo" :alt="doc.name ? `Portrait of ${doc.name}` : 'Portrait'" class="cv-photo">
      <div>
        <h1>{{ doc.name || 'Your name' }}</h1>
        <p v-if="doc.title" class="cv-role">{{ doc.title }}</p>
      </div>
    </header>

    <!-- Main CV columns. Timeline uses the sidebar as a rail; ATS collapses both columns. -->
    <div class="cv-content">
      <!-- Left column: contact details plus layout-specific education, skills, and languages. -->
      <aside class="cv-sidebar">
        <section v-if="doc.contacts.some(contact => contact.value.trim())" class="cv-section">
          <h2 v-if="doc.layout !== 'timeline'">{{ doc.headings.contact }}</h2>
          <ul class="plain-list">
            <li v-for="contact in doc.contacts.filter(entry => entry.value.trim())" :key="contact.id">
              <span v-if="contact.label" class="contact-label">{{ contact.label }}: </span>
              <a v-if="safeUrl(contact.url)" :href="safeUrl(contact.url)">{{ contact.value }}</a>
              <span v-else>{{ contact.value }}</span>
            </li>
          </ul>
        </section>
        <template v-if="doc.layout === 'timeline'">
          <section v-if="hasItems(doc.skills)" class="cv-section">
            <h2>{{ doc.headings.skills }}</h2>
            <ul class="plain-list">
              <li v-for="entry in doc.skills.filter(entry => entry.label.trim() || entry.detail.trim())" :key="entry.id">
                {{ entry.label }}<span v-if="entry.detail"> - {{ entry.detail }}</span>
              </li>
            </ul>
          </section>
          <section v-if="hasItems(doc.languages)" class="cv-section">
            <h2>{{ doc.headings.languages }}</h2>
            <ul class="plain-list">
              <li v-for="entry in doc.languages.filter(entry => entry.label.trim() || entry.detail.trim())" :key="entry.id">
                {{ entry.label }}<span v-if="entry.detail"> - {{ entry.detail }}</span>
              </li>
            </ul>
          </section>
        </template>
        <template v-else>
          <section v-if="hasItems(doc.education)" class="cv-section">
            <h2>{{ doc.headings.education }}</h2>
            <ul class="plain-list">
              <li v-for="entry in doc.education.filter(entry => entry.label.trim() || entry.detail.trim())" :key="entry.id">
                <strong>{{ entry.label }}</strong><span v-if="entry.detail" class="item-detail">{{ entry.detail }}</span>
              </li>
            </ul>
          </section>
          <section v-if="hasItems(doc.languages)" class="cv-section">
            <h2>{{ doc.headings.languages }}</h2>
            <ul class="plain-list">
              <li v-for="entry in doc.languages.filter(entry => entry.label.trim() || entry.detail.trim())" :key="entry.id">
                {{ entry.label }}<span v-if="entry.detail"> - {{ entry.detail }}</span>
              </li>
            </ul>
          </section>
          <section v-if="hasItems(doc.skills)" class="cv-section">
            <h2>{{ doc.headings.skills }}</h2>
            <ul class="plain-list">
              <li v-for="entry in doc.skills.filter(entry => entry.label.trim() || entry.detail.trim())" :key="entry.id">
                {{ entry.label }}<span v-if="entry.detail"> - {{ entry.detail }}</span>
              </li>
            </ul>
          </section>
        </template>
      </aside>

      <!-- Main column: profile, experience, and Timeline education. -->
      <main class="cv-main">
        <section v-if="doc.summary.trim()" class="cv-section">
          <h2 v-if="doc.layout !== 'timeline'">{{ doc.headings.summary }}</h2>
          <p class="preserve-lines">{{ doc.summary }}</p>
        </section>
        <section v-if="doc.experience.some(entry => entry.title || entry.company || entry.dates || entry.description || entry.bullets.some(bullet => bullet.label || bullet.detail))" class="cv-section cv-experience">
          <h2>{{ doc.headings.experience }}</h2>
          <div v-for="entry in doc.experience" :key="entry.id" class="experience-entry">
            <template v-if="doc.layout === 'timeline'">
              <div class="timeline-role-heading">
                <h3>{{ entry.title }}</h3>
                <span v-if="entry.dates">{{ entry.dates }}</span>
              </div>
              <p v-if="entry.company" class="experience-meta timeline-company">{{ entry.company }}</p>
            </template>
            <template v-else>
              <h3>{{ entry.title }}</h3>
              <p class="experience-meta">{{ [entry.company, entry.dates].filter(Boolean).join(' | ') }}</p>
            </template>
            <p v-if="entry.description" class="preserve-lines">{{ entry.description }}</p>
            <ul v-if="entry.bullets.some(bullet => bullet.label || bullet.detail)">
              <li v-for="bullet in entry.bullets.filter(bullet => bullet.label || bullet.detail)" :key="bullet.id">
                {{ bullet.label }}<span v-if="bullet.detail"> - {{ bullet.detail }}</span>
              </li>
            </ul>
          </div>
        </section>
        <section v-if="doc.layout === 'timeline' && hasItems(doc.education)" class="cv-section cv-education">
          <h2>{{ doc.headings.education }}</h2>
          <ul class="plain-list">
            <li v-for="entry in doc.education.filter(entry => entry.label.trim() || entry.detail.trim())" :key="entry.id">
              <strong>{{ entry.label }}</strong><span v-if="entry.detail" class="item-detail">{{ entry.detail }}</span>
            </li>
          </ul>
        </section>
      </main>
    </div>

    <!-- Optional consent statement, anchored to the bottom of paginated layouts. -->
    <footer v-if="doc.showConsent && doc.consent.trim()" class="cv-consent preserve-lines">{{ doc.consent }}</footer>
  </article>
</template>

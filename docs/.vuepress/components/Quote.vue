<template>
  <div class="quote_main">
    <slot />
  </div>
</template>

<script>
export default {
  props: {}
};
</script>

<style lang="stylus">
.quote_main
  background: var(--om-quote-background);
</style>

<template>
  <div class="p-4">
    <h1>Hello World!</h1>
    <p>Welcome to qdadm with Module System v2.</p>
    <div class="mt-4">
      <h2>Module System v2 Features</h2>
      <ul class="list-disc pl-6">
        <li>Modules extend the <code>Module</code> base class</li>
        <li>Static properties: <code>name</code>, <code>requires</code>, <code>priority</code></li>
        <li>Fluent API via <code>KernelContext</code> in <code>connect(ctx)</code></li>
        <li>Automatic dependency resolution and topological sorting</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
// Simple page component
</script>

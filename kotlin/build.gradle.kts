plugins {
    kotlin("jvm") version "2.2.21"
    kotlin("plugin.serialization") version "2.2.21"
}

group = "org.qo.sdk"
version = "1.0.0"

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    testImplementation("org.jetbrains.kotlin:kotlin-test")
}

kotlin {
    jvmToolchain(21)
}

tasks.test {
    useJUnitPlatform()
}

tasks.withType<org.gradle.jvm.tasks.Jar>().configureEach {
    from(listOf(rootProject.file("../LICENSE"), rootProject.file("../COPYING"))) {
        into("META-INF/licenses/quantumoriginal-login-sdk")
    }
}
